import inquirer from 'inquirer';
import chalk from 'chalk';
import Conf from 'conf';
import ora from 'ora';
import fetch from 'node-fetch';

const config = new Conf({ projectName: 'puter-cli' });

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

export function isAuthenticated() {
  return !!config.get('auth_token');
}

export function getAuthToken() {
  return config.get('auth_token');
}

export function getCurrentUserName() {
  return config.get('username');
}