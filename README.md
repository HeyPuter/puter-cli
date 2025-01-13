# Puter-CLI

The **Puter CLI** is a command-line interface tool designed to interact with the **Puter Cloud Platform**. If you don't have an account you can [Signup](https://puter.com/?r=N5Y0ZYTF) from here for free. This cli tool allows users to manage files, directories, applications, and other resources directly from the terminal. This tool is ideal for developers and power users who prefer working with command-line utilities.

---

## Features

- **File Management**: Upload, download, list, and manage files and directories.
- **Authentication**: Log in and log out of your Puter account.
- **User Information**: Retrieve user details, such as username, email, and account status.
- **Disk Usage**: Check disk usage and storage limits.
- **Application Management**: Create, delete, and list applications hosted on Puter.
- **Static Site Hosting**: Deploy static websites from directories.
- **Interactive Shell**: Use an interactive shell for seamless command execution.
- **Cross-Platform**: Works on Windows, macOS, and Linux.

---

## Installation

### Prerequisites
- Node.js (v18 or higher)
- npm (v7 or higher)

Run the following command to install puter-cli globally in your system:
```bash
npm install -g puter-cli
```

Execute the following command to check the installation process:
```bash
puter help
```

## Usage

### Commands

#### Initilize a project
- **Create a new project**: Initilize a new project
```bash
  puter init
```
Then just follow the prompts, this command doesn't require you to login.

#### Authentication
- **Login**: Log in to your Puter account.
```bash
  puter login
```
- **Logout**: Log out of your Puter account.
```bash
  puter logout
```

#### File Management

We've adopted the most basic popluar linux system command line for daily file manipulation with some extra features, not out of the box though, we want to keep it simple.

- **List Files**: List files and directories.
```bash
  puter> ls [dir]
```
- **Change Directory**: Navigate to a directory:
```bash
  puter> cd [dir]
```
It works with wildcards as you would expect in any OS for basic navigation with insensitive case: `cd ..`, `cd ../myapp`...etc.

- **Create Directory**: Create a new directory.
```bash
  puter> mkdir <dir>
```
- **Copy Files**: Copy files or directories.
```bash
  puter> cp <src> <dest>
```
- **Move Files**: Move or rename files or directories.
```bash
  puter> mv <src> <dest>
```
- **Delete Files/Directories**: Move files or directories to the trash.
```bash
  puter> rm [-f] <file>
```
- **Empty Trash**: Empty the system's trash.
```bash
  puter> clean
```
##### Extra commands:

Think of it as `git [push|pull]` commands, they're basically simplified equivalents.

- **Push Files**: Copy files from host machine to the remote cloud instance.
```bash
  puter> push <host_src>
```
- **Pull Files**: Copy files from remote cloud instance to the host machine.
```bash
  puter> pull <remote_src>
```
P.S. These commands consider the current directory as the base path for every operation, basic wildcards are supported: e.g. `push myapp/*.html`.

#### User Information
- **Get User Info**: Display user information.
```bash
  puter whoami
```

#### Disk Usage
- **Check Disk Usage**: Display disk usage information.
```bash
  puter df
```
- **Get Usage Info**: Fetch usage information for services.
```bash
  puter usage
```

#### Application Management

The **Application** are sepcial type of hosted web app, they're served from the special directory at: `<USERNAME>/AppData/<UUID>...`, more details at **app:create** in the section below.

- **List Applications**: List all applications.
```bash
  puter apps [period]
```
P.S. Please check the help command `help apps` for more details about any argument.

- **Create Application**: Create a new application.
```bash
  puter app:create <name> [<remote_dir>] [--description=<description>] [--url=<url>]
```
P.S. By default a new `index.html` with basic content will be created, but you can set a directory when you create a new application as follows: `app:create nameOfApp ./appDir`, so all files will be copied to the `AppData` directoy, you can then update your app using `app:update <name> <remote_dir>`. This command will attempt to create a subdomain with a random `uid` prefixed with the name of the app.

- **Update Application**: Update an application.
```bash
  puter app:update <name> <remote_dir>
```
**IMPORTANT** All existing files will be overwritten, new files are copied, other files are just ignored.

- **Delete Application**: Delete an application.
```bash
  puter app:delete [-f] <name>
```
P.S. This command will lookup for the allocated `subdomain` and attempt to delete it if it exists.

#### Static Sites

The static sites are served from the selected directory (or the current directory if none is specified).

- **Deploy Site**: Deploy a static website from a directory.
```bash
  puter site:create <dir> [--subdomain=<name>]
```
P.S. If the subdomain already exists, it will generate a new random one can set your own subdomain using `--subdomain` argument.

- **List Sites**: List all hosted sites.
```bash
  puter sites
```
- **Delete Site**: Delete a hosted site.
```bash
  puter site:delete <uid>
```
P.S. You can find the `<uid>` in the list of `sites`.

#### Interactive Shell
- **Start Shell**: Launch an interactive shell.
```bash
  puter [shell]
```
or just type (you'll need to login):
```bash
  puter
```

#### Help
- **General Help**: Display a list of available commands.
```bash
  puter help
```
- **Command Help**: Display detailed help for a specific command.
```bash
  puter help <command>
```

---

## Examples

1. **Log in and List Files**:
 ```bash
   puter login
   puter> ls
 ```

2. **Create and Deploy a Static Site**:
 ```bash
   puter> mkdir my-site
   puter> site:create my-site --subdomain=myapp
 ```

3. **Check Disk Usage**:
 ```bash
   puter> df
 ```

4. **Delete a File**:
 ```bash
   puter> rm /path/to/file
 ```

5. **Display statistics**:
 ```bash
   puter> stat /path/to/file/or/directory
 ```

---

## Development

If you want to customize this tool you can follow these steps:

### Steps
1. Clone the repository:
 ```bash
   git clone https://github.com/bitsnaps/puter-cli.git
   cd puter-cli
 ```
2. Install dependencies:
 ```bash
   npm install
 ```
3. Link the CLI globally:
 ```bash
   npm link
 ```

---

## Known issues:

Most of the functionalities are just working fine, however some APIs related to Puter's SDK have some known issues. We tried to fix most them but some of them are not related to us, so we let you about that in case it'll be fixed by Puter's in the future:

## Delete a subdomain
When you try to delete a subdomain which you own, you'll get `Permission denied`:
```bash
Failed to delete subdomain: Permission denied.
Site ID: "sd-b019b654-e06f-48a8-917e-ae1e83825ab7" may already be deleted!
```
However, the query is executed successfully at the cloud and the subdomain is actually deleted.

## Interactive Shell prompt:
If you want to stay in the interactive shell you should provide "-f" (aka: force delete) argument, when want to delete any object:
```bash
puter@username/myapp> rm README.md
The following items will be moved to Trash:
- /username/myapp/README.md
? Are you sure you want to move these 1 item(s) to Trash? (y/N) n
puter@username/myapp> Operation canceled.
username:~/home$ puter
puter@username/myapp> rm -f README.md
Successfully moved "/username/myapp/README.md" to Trash!
```
Otherwise, the Interactive Shell mode will be terminated.

---

## Notes

This project is not equivalent [phoenix](https://github.com/HeyPuter/puter/blob/main/src/phoenix/README.md), niether an attempt to mimic some it's features, it's rather a CLI tool to do most the Puter's API from command line.

---

## Configuration

The CLI uses a configuration file to store user credentials and settings. By default, this file is located at `~/.config/puter-cli/config.json`. You can manually edit this file or use the `puter logout` to empty the file settings.

---

## Contributing

We welcome contributions! Please follow these steps:
1. Fork the repository.
2. Create a new branch for your feature or bugfix with a reproducible steps.
3. Submit a pull request with a detailed description of your changes.

---

## License

This project is licensed under the **[NoHarm License](https://github.com/raisely/NoHarm/blob/publish/LICENSE.md)**. See the [LICENSE](LICENSE.md) file for details.

---

## Support

For issues or questions, please open an issue on [GitHub](https://github.com/bitsnaps/puter-cli/issues) or contact [puter's team](hey@puter.com) if you found an issue related to Puter's APIs.

---

## Acknowledgments

- **Puter Cloud Platform** for providing the backend infrastructure.
- **Node.js** and **npm** for enabling this project.
- The open-source community for their invaluable contributions.

---


Happy deploing with **Puter CLI**! 🚀