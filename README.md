# Puter-CLI

This project is a simple Puter-CLI tool that allows Puter's users to connect remotely to their Puter instance and manipulate anything using command line tool.

# Known issues:

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
