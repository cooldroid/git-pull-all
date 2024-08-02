var exec = require('child_process').exec;
var fs = require('fs');
var join = require('path').join;
var sep = require('path').sep;
var basename = require('path').basename;

var async = require('async');

function dirname(path) {
  return '\x1b[36m' + path.split(sep).slice(-2).join(sep) + '\x1b[39m';
}

/**
 * Return true if the given file path is a directory.
 *
 * @param  {String}   file
 * @param  {Function} callback
 */
function isDirectory(file, callback) {
  fs.stat(file, function(err, stats) {
    if (err) {
      var message = [
        'Something went wrong on "' + file + '"',
        'Message: ' + err.message
      ].join('\n');
      console.log(message);
      return callback(false);
    }
    callback(stats.isDirectory());
  });
}

/**
 * Check if the given directory is a git repo.
 *
 * @param  {String}   dir
 * @param  {Function} callback
 */
function isGitProject(dir, callback) {
  ret = fs.existsSync(join(dir, '.git'));
  if (!ret) {
    console.log(dirname(dir), ':', 'Not a git repository');
  } else if (fs.existsSync(join(dir, '.git', '.skip'))) {
    console.log(dirname(dir), ':', 'Skip this git repository');
    ret = false;
  }
  callback(ret);
}

/**
 * Check if the given directory is not a git repo.
 *
 * @param  {String}   dir
 * @param  {Function} callback
 */
function isNotGitProject(dir, callback) {
  var ret = fs.existsSync(join(dir, '.git'));
  callback(!ret);
}

/**
 * Run the given command.
 *
 * @param  {String} command
 * @param  {Object} options
 */
function run(command, options, callback) {
  options = options || {};
  exec(command, options, callback);
}

/**
 * Check if remote tracking repo is defined.
 *
 * @param  {String}   dir
 * @param  {Function} callback
 */
function hasRemoteRepo(dir, callback) {
  var command = 'git remote show';
  run(command, { cwd: dir }, function(err, stdout, stderr) {
    if (err || stderr) {
      var message = '';
      message += 'Something went wrong on "' + dir + '" ...';
      message += 'Command: ' + command;
      if (err) {
        message += 'Message: ' + err.message;
      } else if (stderr) {
        message += 'Message: ' + stderr;;
      }
      console.log(message);
      return callback(false);
    }
    if (!stdout) {
      console.log(dirname(dir), ':', 'Remote tracking repository is not defined');
    }
    callback(!!stdout);
  });
}

/**
 * Run "git pull --rebase" on the given directory.
 *
 * @param  {String}   dir
 * @param  {Function} callback
 */
function gitPull(dir, callback) {
  var command = 'git pull --rebase --autostash --recurse-submodules';
  run(command, { cwd: dir }, function(err, stdout, stderr) {
    if (err) {
      var message = [
        dirname(dir),
        'Something went wrong on "' + dir + '" ...',
        // 'Command: ' + command,
        'Message: ' + err.message
      ].join('\n');
      console.log(message);
      // return callback(new Error(message));
    } else {
      process.stdout.write(dirname(dir) + " : ");
      if (stdout) {
        process.stdout.write(stdout);
      }
      if (stderr) {
        process.stdout.write(stderr);
      }
    }
    return callback();
  });
}

function readFiles(dir, callback) {
  fs.readdir(dir, function(err, children) {
    if (err) {
      return callback(err);
    }
    var files = children.map(function(child) {
      return join(dir, child);
    });
    return callback(null, files);
  });
}

function pullFromDirectoryRecursively(dir){
  pullFromDirectory(dir);
  readFiles(dir, function(err, files) {
    if (err) {
      return console.log(err.message);
    }

    // Returns files
    async.filter(files, isDirectory, function(dirs) {
      // Returns non-git projects
      async.filter(dirs, isNotGitProject, function(nonGitProjects) {
        // pull recursively for non-git projects
        async.each(nonGitProjects, pullFromDirectoryRecursively, function(err) {
          if (err) {
            console.log(err.message);
            return;
          }
        })
      });
    });
  });
}

function pullFromDirectory(parent) {
  readFiles(parent, function(err, files) {
    if (err) {
      return console.log(err.message);
    }

    // Returns files
    async.filter(files, isDirectory, function(dirs) {

      // Returns git projects
      async.filter(dirs, isGitProject, function(gitProjects) {

        // Ignore if project does not have remote tracking repo
        async.filter(gitProjects, hasRemoteRepo, function(trackingRepos) {

          async.each(trackingRepos, gitPull, function(err) {
            if (err) {
              console.log(err.message);
              return;
            } else {
              console.log('Done for folder:', '\x1b[32m' + parent.split(sep).slice(-2).join(sep) + '\x1b[39m');
            }
          });
        });
      });
    });
  });
}

/**
 * Main function.
 *
 * @param  {String} parent
 */
module.exports = function(parent, isRecursive) {
  if (isRecursive) {
    pullFromDirectoryRecursively(parent);
  }else{
    pullFromDirectory(parent);
  }
};
