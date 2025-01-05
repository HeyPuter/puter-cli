import inquirer from 'inquirer';
import chalk from 'chalk';
import Conf from 'conf';
import ora from 'ora';
import fetch from 'node-fetch';
import { PROJECT_NAME, API_BASE, getHeaders } from './commons.js'
const config = new Conf({ projectName: PROJECT_NAME });

/**
 * Login user
 * @returns void
 */
export async function login() {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'username',
      message: 'Username:',
      validate: input => input.length >= 1 || 'Username is required'
    },
    {
      type: 'password',
      name: 'password',
      message: 'Password:',
      mask: '*',
      validate: input => input.length >= 1 || 'Password is required'
    }
  ]);

  const spinner = ora('Logging in to Puter...').start();
  
  try {
    const response = await fetch('https://puter.com/login', {
      method: 'POST',
      headers: {
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Connection': 'keep-alive',
        'Content-Type': 'application/json',
        'Origin': 'https://puter.com',
        'Referer': 'https://puter.com/',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
      },
      body: JSON.stringify({
        username: answers.username,
        password: answers.password
      })
    });

    const data = await response.json();

    if (data.proceed && data.token) {
      config.set('auth_token', data.token);
      config.set('username', answers.username);
      config.set('cwd', `/${answers.username}`);
      
      spinner.succeed(chalk.green('Successfully logged in to Puter!'));
      console.log(chalk.dim(`Token: ${data.token.slice(0, 5)}...${data.token.slice(-5)}`));
    } else {
      spinner.fail(chalk.red('Login failed. Please check your credentials.'));
    }
  } catch (error) {
    spinner.fail(chalk.red('Failed to login'));
    console.error(chalk.red(`Error: ${error.message}`));
  }
}

/**
 * Logout user
 * @returns void
 */
export async function logout() {
  const spinner = ora('Logging out from Puter...').start();
  
  try {
    const token = config.get('auth_token');
    if (!token) {
      spinner.info(chalk.yellow('Already logged out'));
      return;
    }

    config.clear(); // Remove all stored data
    spinner.succeed(chalk.green('Successfully logged out from Puter!'));
  } catch (error) {
    spinner.fail(chalk.red('Failed to logout'));
    console.error(chalk.red(`Error: ${error.message}`));
  }
}

export async function getUserInfo() {
  console.log(chalk.green('Getting user info...\n'));
  try {
    const response = await fetch(`${API_BASE}/whoami`, {
      method: 'GET',
      headers: getHeaders()
    });
    const data = await response.json();
    if (data) {
      console.log(chalk.cyan('User Information:'));
      console.log(chalk.dim('----------------------------------------'));
      console.log(chalk.cyan(`Username: `) + chalk.white(data.username));
      console.log(chalk.cyan(`UUID: `) + chalk.white(data.uuid));
      console.log(chalk.cyan(`Email: `) + chalk.white(data.email));
      console.log(chalk.cyan(`Email Confirmed: `) + chalk.white(data.email_confirmed ? 'Yes' : 'No'));
      console.log(chalk.cyan(`Temporary Account: `) + chalk.white(data.is_temp ? 'Yes' : 'No'));
      console.log(chalk.cyan(`Account Age: `) + chalk.white(data.human_readable_age));
      console.log(chalk.dim('----------------------------------------'));
      console.log(chalk.cyan('Feature Flags:'));
      for (const [flag, enabled] of Object.entries(data.feature_flags)) {
        console.log(chalk.cyan(`  - ${flag}: `) + chalk.white(enabled ? 'Enabled' : 'Disabled'));
      }
      console.log(chalk.dim('----------------------------------------'));
      console.log(chalk.green('Done.'));
    } else {
      console.error(chalk.red('Unable to get your info. Please check your credentials.'));
    }
  } catch (error) {
    console.error(chalk.red(`Failed to get user info.\nError: ${error.message}`));
  }
}
export function isAuthenticated() {
  return !!config.get('auth_token');
}

export function getAuthToken() {
  return config.get('auth_token');
}

export function getCurrentUserName() {
  return config.get('username');
}

export function getCurrentDirectory() {
  return config.get('cwd');
}