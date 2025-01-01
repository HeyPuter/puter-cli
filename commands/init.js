import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { promises as fs } from 'fs';
import path from 'path';

export async function init() {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'What is your app name?',
      default: path.basename(process.cwd())
    },
    {
      type: 'list',
      name: 'template',
      message: 'Select a template:',
      choices: ['basic', 'static-site', 'full-stack']
    }
  ]);

  const spinner = ora('Creating Puter app...').start();

  try {
    // Create basic app structure
    await createAppStructure(answers);
    spinner.succeed(chalk.green('Successfully created Puter app!'));
    
    console.log('\nNext steps:');
    console.log(chalk.cyan('1. cd'), answers.name);
    console.log(chalk.cyan('2. npm install'));
    console.log(chalk.cyan('3. npm start'));
  } catch (error) {
    spinner.fail(chalk.red('Failed to create app'));
    console.error(error);
  }
}

async function createAppStructure({ name, template }) {
  // Create project directory
  await fs.mkdir(name, { recursive: true });

  // Create basic files
  const files = {
    '.env': `APP_NAME=${name}\PUTER_API_KEY=`,
    'index.html': `<!DOCTYPE html>
<html>
<head>
    <title>${name}</title>
</head>
<body>
    <h1>Welcome to ${name}</h1>
    <script src="https://js.puter.com/v2/"></script>
    <script src="app.js"></script>
</body>
</html>`,
    'app.js': `// Initialize Puter app
console.log('Puter app initialized!');`,
    'README.md': `# ${name}\n\nA Puter app created with puter-cli`
  };

  for (const [filename, content] of Object.entries(files)) {
    await fs.writeFile(path.join(name, filename), content);
  }
}