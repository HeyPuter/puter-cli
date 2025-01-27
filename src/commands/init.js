import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { promises as fs } from 'fs';
import path from 'path';
import { generateAppName, getDefaultHomePage } from '../commons.js';

const JS_BUNDLERS = ['Vite', 'Webpack', 'Parcel', 'esbuild', 'Farm'];
const FULLSTACK_FRAMEWORKS = ['Next', 'Nuxt', 'SvelteKit', 'Astro'];
const JS_LIBRARIES = ['React', 'Vue', 'Angular', 'Svelte', 'jQuery'];
const CSS_LIBRARIES = ['Bootstrap', 'Bulma', 'shadcn', 'Tailwind', 'Material-UI', 'Semantic UI', 'AntDesign', 'Element-Plus', 'PostCSS', 'AutoPrefixer'];

export async function init() {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'What is your app name?',
      default: `${generateAppName()}`
    },
    {
      type: 'list',
      name: 'useBundler',
      message: 'Do you want to use a JavaScript bundler?',
      choices: ['Yes', 'No (Use CDN)']
    }
  ]);

  let jsFiles = [];
  let cssFiles = [];
  let extraFiles = [];
  let bundlerAnswers = null;
  let frameworkAnswers = null;

  if (answers.useBundler === 'Yes') {
    bundlerAnswers = await inquirer.prompt([
      {
        type: 'list',
        name: 'bundler',
        message: 'Select a JavaScript bundler:',
        choices: JS_BUNDLERS
      },
      {
        type: 'list',
        name: 'frameworkType',
        message: 'Do you want to use a full-stack framework or custom libraries?',
        choices: ['Full-stack framework', 'Custom libraries']
      }
    ]);

    if (bundlerAnswers.frameworkType === 'Full-stack framework') {
      frameworkAnswers = await inquirer.prompt([
        {
          type: 'list',
          name: 'framework',
          message: 'Select a full-stack framework:',
          choices: FULLSTACK_FRAMEWORKS
        }
      ]);

      switch (frameworkAnswers.framework) {
        case FULLSTACK_FRAMEWORKS[0]:
          jsFiles.push('next@latest');
          extraFiles.push({
            path: 'src/index.tsx',
            content: `export default function Home() { return (<h1>${answers.name}</h1>) }`
          });
          break;
        case FULLSTACK_FRAMEWORKS[1]:
          jsFiles.push('nuxt@latest');
          extraFiles.push({
            path: 'src/app.vue',
            content: `<template><h1>${answers.name}</h1></template>`
          });
          break;
          case FULLSTACK_FRAMEWORKS[2]:
            jsFiles.push('svelte@latest', 'sveltekit@latest');
            extraFiles.push({
              path: 'src/app.vue',
              content: `<template><h1>${answers.name}</h1></template>`
            });
            break;
            case FULLSTACK_FRAMEWORKS[3]:
              jsFiles.push('astro@latest', 'astro@latest');
              extraFiles.push({
                path: 'src/pages/index.astro',
                content: `---\n\n<Layout title="Welcome to ${answers.name}."><h1>${answers.name}</h1></Layout>`
              });
          break;
      }
    } else {
      const libraryAnswers = await inquirer.prompt([
        {
          type: 'list',
          name: 'library',
          message: 'Select a JavaScript library/framework:',
          choices: JS_LIBRARIES
        }
      ]);

      switch (libraryAnswers.library) {
        case JS_LIBRARIES[0]:
          jsFiles.push('react@latest', 'react-dom@latest');
          const reactLibs = await inquirer.prompt([
            {
              type: 'checkbox',
              name: 'reactLibraries',
              message: 'Select React libraries:',
              choices: CSS_LIBRARIES.concat(['react-router-dom', 'react-redux', 'react-bootstrap', '@chakra-ui/react', 'semantic-ui-react'])
            }
          ]);
          jsFiles.push(...reactLibs.reactLibraries);
          extraFiles.push({
            path: 'src/App.jsx',
            content: `export default function Home() { return (<h1>${answers.name}</h1>) }`
          });
          break;
        case JS_LIBRARIES[1]:
          jsFiles.push('vue@latest');
          const vueLibs = await inquirer.prompt([
            {
              type: 'checkbox',
              name: 'vueLibraries',
              message: 'Select Vue libraries:',
              choices: CSS_LIBRARIES.concat(['shadcn-vue', 'UnoCSS', 'NaiveUI', 'bootstrap-vue-next', 'buefy', 'vue-router', 'pinia'])
            }
          ]);
          jsFiles.push(...vueLibs.vueLibraries);
          extraFiles.push({
            path: 'src/App.vue',
            content: `<template><h1>${answers.name}</h1></template>`
          });
          break;
        case JS_LIBRARIES[2]:
          jsFiles.push('@angular/core@latest');
          extraFiles.push({
            path: 'src/index.controller.js',
            content: `(function () { angular.module('app', [])})`
          });
          break;
        case JS_LIBRARIES[3]:
          jsFiles.push('svelte@latest');
          break;
        case JS_LIBRARIES[4]:
          jsFiles.push('jquery@latest');
          extraFiles.push({
            path: 'src/main.js',
            content: `$(function(){})`
          });
          break;
      }
    }
  } else {

    const cdnAnswers = await inquirer.prompt([
      {
        type: 'list',
        name: 'jsFramework',
        message: 'Select a JavaScript framework/library (CDN):',
        choices: JS_LIBRARIES
      },
      {
        type: 'list',
        name: 'cssFramework',
        message: 'Select a CSS framework/library (CDN):',
        choices: CSS_LIBRARIES //'Tailwind', 'Bootstrap', 'Bulma'...
      }
    ]);

    switch (cdnAnswers.jsFramework) {
      case JS_LIBRARIES[0]:
        jsFiles.push('https://unpkg.com/react@latest/umd/react.production.min.js');
        jsFiles.push('https://unpkg.com/react-dom@latest/umd/react-dom.production.min.js');
        break;
      case JS_LIBRARIES[1]:
        jsFiles.push('https://unpkg.com/vue@latest/dist/vue.global.js');
        break;
      case JS_LIBRARIES[2]:
        jsFiles.push('https://unpkg.com/@angular/core@latest/bundles/core.umd.js');
        break;
      case JS_LIBRARIES[3]:
        jsFiles.push('https://unpkg.com/svelte@latest/compiled/svelte.js');
        break;
      case JS_LIBRARIES[4]:
        jsFiles.push('https://code.jquery.com/jquery-latest.min.js');
        break;
    }

    switch (cdnAnswers.cssFramework) {
      case CSS_LIBRARIES[0]:
        cssFiles.push('https://cdn.jsdelivr.net/npm/bootstrap@latest/dist/css/bootstrap.min.css');
        break;
        case CSS_LIBRARIES[1]:
          cssFiles.push('https://cdn.jsdelivr.net/npm/bulma@latest/css/bulma.min.css');
          break;
      case CSS_LIBRARIES[2]:
        cssFiles.push('https://cdn.tailwindcss.com');
        break;
    }
  }

  const spinner = ora('Creating Puter app...').start();

  try {
    const useBundler = answers.useBundler === 'Yes';
    // Create basic app structure
    await createAppStructure(answers.name, useBundler, bundlerAnswers, frameworkAnswers, jsFiles, cssFiles, extraFiles);
    spinner.succeed(chalk.green('Successfully created Puter app!'));

    console.log('\nNext steps:');
    console.log(chalk.cyan('1. cd'), answers.name);
    if (useBundler) {
      console.log(chalk.cyan('2. npm install'));
      console.log(chalk.cyan('3. npm start'));
    } else {
      console.log(chalk.cyan('2. Open index.html in your browser'));
    }
  } catch (error) {
    spinner.fail(chalk.red('Failed to create app'));
    console.error(error);
  }
}

async function createAppStructure(name, useBundler, bundlerAnswers, frameworkAnswers, jsFiles, cssFiles, extraFiles) {
  // Create project directory
  await fs.mkdir(name, { recursive: true });

  // Generate default home page
  const homePage = useBundler?getDefaultHomePage(name): getDefaultHomePage(name, jsFiles, cssFiles);

  // Create basic files
  const files = {
    '.env': `APP_NAME=${name}\nPUTER_API_KEY=`,
    'index.html': homePage,
    'styles.css': `body {
    font-family: 'Segoe UI', Roboto, sans-serif;
    margin: 0 auto;
    padding: 10px;
  }`,
    'app.js': `// Initialize Puter app
console.log('Puter app initialized!');`,
    'README.md': `# ${name}\n\nA Puter app created with puter-cli`
  };

  for (const [filename, content] of Object.entries(files)) {
    await fs.writeFile(path.join(name, filename), content);
  }

  // If using a bundler, create a package.json
  // if (jsFiles.some(file => !file.startsWith('http'))) {
  if (useBundler) {

    const useFullStackFramework = bundlerAnswers.frameworkType === 'Full-stack framework';
    const bundler = bundlerAnswers.bundler.toString().toLowerCase();
    const framework = useFullStackFramework?frameworkAnswers.framework.toLowerCase():null;

    const scripts = {
      start: `${useFullStackFramework?`${framework} dev`:bundler} dev`,
      build: `${useFullStackFramework?`${framework} build`:bundler} build`,
    };
    
    const packageJson = {
      name: name,
      version: '1.0.0',
      scripts,
      dependencies: {},
      devDependencies: {}
    };

    jsFiles.forEach(lib => {
      if (!lib.startsWith('http')) {
        packageJson.dependencies[lib.split('@')[0].toString().toLowerCase()] = lib.split('@')[1] || 'latest';
      }
    });

    packageJson.devDependencies[bundler] = 'latest';

    await fs.writeFile(path.join(name, 'package.json'), JSON.stringify(packageJson, null, 2));

    extraFiles.forEach(async (extraFile) => {
      const fullPath = path.join(name, extraFile.path);
      // Create directories recursively if they don't exist
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, extraFile.content);
    });

  }
}