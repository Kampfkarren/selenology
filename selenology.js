const { exec: execChildProcess } = require("child_process");
const diff = require("diff");
const escape = require("escape-html");
const fs = require("fs/promises");
const path = require("path");
const process = require("process");

const repos = require("./repos.json");

const write = (text) => process.stdout.write(text);

const exec = (command, options) => {
  return new Promise((resolve, reject) => {
    execChildProcess(command, options, (error, stdout) => {
      if (error) {
        reject(error);
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
      rendered += `<span style='background-color: #033a16; color: #aff5b4'>${processText(
        diffPart.value
      )}</span>`;
    } else if (diffPart.removed) {
      rendered += `<span style='background-color: #67060c; color: #ffdcd7'>${processText(
        diffPart.value
      )}</span>`;
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
      console.debug(text);
    }
  };

  write("<!DOCTYPE html>");
  write("<html>");
  write("<head>");
  write("<meta charset='utf-8'>");
  write("<style>body {{ font-family: Consolas, monospace; }}</style>");
  write("</head>");
  write("<body>");

  const runOnRepo = async (repoName, repository) => {
    debug(`scanning ${repoName}`);

    const directory = path.join(CLONE_DIRECTORY, repoName);
    await fs.mkdir(directory);

    await exec("git init", { cwd: directory });
    await exec(`git remote add origin ${repository.repo}`, { cwd: directory });
    await exec(`git fetch --depth 1 origin ${repository.branch}`, {
      cwd: directory,
    });
    await exec(`git checkout FETCH_HEAD`, { cwd: directory });

    debug("running old selene");
    const oldOutput = await exec(
      `${SELENE_OLD} ${repository.args.join(" ")} --num-threads 1`,
      {
        cwd: directory,
      }
    );

    const robloxStd = path.join(directory, "roblox.yml");
    if (path.exists(robloxStd)) {
      debug(`deleting ${robloxStd}`);
      await fs.rm(robloxStd);
    }

    debug("running new selene");
    const newOutput = await exec(
      `${SELENE_NEW} ${repository.args.join(" ")} --num-threads 1`,
      {
        cwd: directory,
      }
    );

    debug("checking difference");

    const difference = diff.diffTrimmedLines(oldOutput, newOutput);
    write(renderDiff(repoName, difference));
  };

  for (const [repoName, repo] of Object.entries(repos)) {
    await runOnRepo(repoName, repo);
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
