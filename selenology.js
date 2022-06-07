const { exec: execChildProcess } = require("child_process");
const diff = require("diff");
const escape = require("escape-html");
const extract = require("extract-zip");
const { createWriteStream, existsSync } = require("fs");
const fs = require("fs/promises");
const path = require("path");
const process = require("process");

const repos = require("./repos.json");
const wallyPackages = require("./wally-packages.json");

const write = (text) => process.stdout.write(text);

const exec = (command, options) => {
  return new Promise((resolve) => {
    execChildProcess(command, options, (_error, stdout, stderr) => {
      if (stderr) {
        resolve(stderr);
      } else {
        resolve(stdout);
      }
    });
  });
};

const processText = (text) => escape(text).replace(/\n/g, "<br />");

const renderDiff = (id, diff) => {
  let rendered = `<div><h2>${id}</h2>`;

  for (const diffPart of diff) {
    if (diffPart.added) {
      rendered += `<span class='add'>${processText(diffPart.value)}</span>`;
    } else if (diffPart.removed) {
      rendered += `<span class='remove'>${processText(diffPart.value)}</span>`;
    } else {
      rendered += processText(diffPart.value);
    }
  }

  rendered += "</div><hr />";
  return rendered;
};

const main = async () => {
  const { SELENE_OLD, SELENE_NEW, CLONE_DIRECTORY, DEBUG } = process.env;
  if (!SELENE_OLD) {
    throw new Error("SELENE_OLD not set");
  }

  if (!SELENE_NEW) {
    throw new Error("SELENE_NEW not set");
  }

  if (!CLONE_DIRECTORY) {
    throw new Error("CLONE_DIRECTORY not set");
  }

  const debug = (text) => {
    if (DEBUG) {
      process.stderr.write(`${text}\n`);
    }
  };

  write("<!DOCTYPE html>");
  write("<html>");
  write("<head>");
  write("<meta charset='utf-8'>");

  write("<style>");
  write("body { font-family: Consolas, monospace; } ");
  write(".add { background-color: #033a16; color: #aff5b4; } ");
  write(".remove { background-color: #67060c; color: #ffdcd7; }");
  write("</style>");

  write("</head>");
  write("<body>");

  const compare = async (directory, args) => {
    debug("running old selene");
    const oldOutput = await exec(
      `${SELENE_OLD} ${args.join(" ")} --num-threads 1`,
      {
        cwd: directory,
      }
    );

    const robloxStd = path.join(directory, "roblox.yml");
    if (existsSync(robloxStd)) {
      debug(`deleting ${robloxStd}`);
      await fs.rm(robloxStd);
    }

    debug("running new selene");
    const newOutput = await exec(
      `${SELENE_NEW} ${args.join(" ")} --num-threads 1`,
      {
        cwd: directory,
      }
    );

    debug("checking difference");

    const difference = diff.diffTrimmedLines(oldOutput, newOutput);
    write(renderDiff(repoName, difference));

    await fs.rm(directory, {
      force: true,
      recursive: true,
    });
  };

  const runOnRepo = async (repoName, repository) => {
    debug(`scanning ${repoName}`);

    const directory = path.join(CLONE_DIRECTORY, repoName);
    await fs.mkdir(directory, {
      recursive: true,
    });

    await exec(`git clone --depth 1 ${repository.repo} ${directory}`);

    return compare(directory, repository.args);
  };

  for (const [repoName, repo] of Object.entries(repos)) {
    await runOnRepo(repoName, repo);
  }

  const runOnWallyPackage = async (wallyPackageName, wallyPackageInfo) => {
    const directory = path.join(CLONE_DIRECTORY, wallyPackageName);
    await fs.mkdir(directory, {
      recursive: true,
    });

    const zipPath = path.join(directory, "package.zip");
    const fileStream = createWriteStream(zipPath);

    // This shouldn't run for more than a second, which is the API limit
    const wallyResponse = await fetch(
      `https://api.wally.run/v1/package-contents/${wallyPackageName}/${wallyPackageInfo.version}`,
      {
        headers: {
          "Wally-Version": "0.3.1",
          "User-Agent": "selenology",
        },
      }
    );

    await wallyResponse.body.pipeTo(fileStream);

    await extract(zipPath, { dir: directory });

    const seleneTomlPath = path.join(directory, "selene.toml");
    if (!existsSync(seleneTomlPath)) {
      await fs.writeFile(seleneTomlPath, `std = "roblox"`);
    }

    return compare(directory, wallyPackageInfo.args);
  };

  for (const [wallyPackageName, wallyPackageInfo] of Object.entries(
    wallyPackages
  )) {
    runOnWallyPackage(wallyPackageName, wallyPackageInfo).catch((error) => {
      console.error(`${wallyPackageName}: ${error}`);
    });
  }

  write("</body>");
  write("</html>");
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
