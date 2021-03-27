use std::{collections::BTreeMap, env, fs, path::PathBuf, process::Command};

use anyhow::Context;

use dissimilar::Chunk;

use serde::Deserialize;

#[derive(Debug, Deserialize)]
struct Repository {
    branch: String,
    repo: String,
    args: Vec<PathBuf>,
    #[serde(default)]
    roblox: bool,
}

#[derive(Debug)]
struct EnvArgs {
    old_selene: PathBuf,
    new_selene: PathBuf,
    clone_directory: PathBuf,
}

fn process_text(text: &str) -> String {
    htmlescape::encode_minimal(&text).replace('\n', "<br />")
}

fn render_diff(id: &str, diff: &[Chunk<'_>]) -> String {
    let mut string = format!("<div><h2>{}</h2>", id);
    string.extend(diff.iter().copied().map(|chunk| match chunk {
        Chunk::Delete(text) => format!(
            "<span style='background-color: #67060c; color: #ffdcd7'>{}</span>",
            process_text(text),
        ),
        Chunk::Equal(text) => process_text(text),
        Chunk::Insert(text) => format!(
            "<span style='background-color: #033a16; color: #aff5b4'>{}</span>",
            process_text(text)
        ),
    }));
    string.push_str("</div><hr />");
    string
}

impl EnvArgs {
    fn collect() -> anyhow::Result<Self> {
        Ok(EnvArgs {
            old_selene: env::var("SELENE_OLD")
                .context("no SELENE_OLD env var")?
                .into(),
            new_selene: env::var("SELENE_NEW")
                .context("no SELENE_NEW env var")?
                .into(),
            clone_directory: env::var("CLONE_DIRECTORY")
                .context("no CLONE_DIRECTORY env var")?
                .into(),
        })
    }
}

fn collect_repos() -> anyhow::Result<BTreeMap<String, Repository>> {
    Ok(toml::from_str(include_str!("../repos.toml"))?)
}

fn main() -> anyhow::Result<()> {
    log::debug!("selenology");

    env_logger::init();

    let args = EnvArgs::collect()?;

    let repos = collect_repos()?;

    print!("<!DOCTYPE html>");
    print!("<html>");
    print!("<head>");
    print!("<meta charset='utf-8'>");
    print!("<style>body {{ font-family: Consolas, monospace; }}</style>");
    print!("</head>");
    print!("<body>");

    for (id, repository) in repos {
        log::debug!("scanning {}", id);

        let repo_directory = args.clone_directory.join(&id);
        fs::create_dir(&repo_directory).context(format!("creating directory for {}", id))?;

        Command::new("git")
            .arg("init")
            .current_dir(&repo_directory)
            .output()
            .context(format!("{}: initializing", id))?;

        Command::new("git")
            .args(&["remote", "add", "origin", &repository.repo])
            .current_dir(&repo_directory)
            .output()
            .context(format!("{}: setting up remotes", id))?;

        Command::new("git")
            .args(&["fetch", "--depth", "1", "origin", &repository.branch])
            .current_dir(&repo_directory)
            .output()
            .context(format!("{}: fetching origin", id))?;

        Command::new("git")
            .args(&["checkout", "FETCH_HEAD"])
            .current_dir(&repo_directory)
            .output()
            .context(format!("{}: checking out repository", id))?;

        // TODO: Remove this when the 'selene doesn't rerun with new roblox.toml' bug is fixed
        if repository.roblox {
            log::debug!("generating roblox std on old selene");
            Command::new(&args.old_selene)
                .arg("generate-roblox-std")
                .current_dir(&repo_directory)
                .output()
                .context(format!("{}: generating roblox std with old selene", id))?;
        }

        log::debug!("running old selene");

        let old_output = Command::new(&args.old_selene)
            .args(&repository.args)
            .args(&["--num-threads", "1"])
            .current_dir(&repo_directory)
            .output()
            .context(format!("{}: running old selene", id))?
            .stdout;

        let old_output = std::str::from_utf8(&old_output)
            .context(format!("{}: parsing old selene's output as utf-8", id))?;

        log::debug!("running new selene");

        if repository.roblox {
            log::debug!("generating roblox std on current selene");
            fs::remove_file(&repo_directory.join("roblox.toml"))
                .context(format!("{}: deleting old roblox.toml", id))?;

            Command::new(&args.old_selene)
                .arg("generate-roblox-std")
                .current_dir(&repo_directory)
                .output()
                .context(format!("{}: generating roblox std with current selene", id))?;
        }

        let new_output = Command::new(&args.new_selene)
            .args(&repository.args)
            .args(&["--num-threads", "1"])
            .current_dir(&repo_directory)
            .output()
            .context(format!("{}: running new selene", id))?
            .stdout;

        let new_output = std::str::from_utf8(&new_output)
            .context(format!("{}: parsing new selene's output as utf-8", id))?;

        let difference = dissimilar::diff(old_output, new_output);

        let rendered = render_diff(&id, &difference);
        print!("{}", rendered);
    }

    print!("</body></html>");

    Ok(())
}
