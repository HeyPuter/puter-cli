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
      headers: getHeaders(),
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
      
      console.log('Successfully logged in to Puter!');
      console.log(chalk.dim(`Token: ${data.token.slice(0, 5)}...${data.token.slice(-5)}`));
    } else {
      spinner.fail(chalk.red('Login failed. Please check your credentials.'));
    }
  } catch (error) {
    console.error('Failed to login');
    console.error(`Error: ${error.message}`);
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

/**
 * Fetch usage information
 */
export async function getUsageInfo() {
  console.log(chalk.green('Fetching usage information...\n'));
  try {
      const response = await fetch(`${API_BASE}/drivers/usage`, {
          method: 'GET',
          headers: getHeaders()
      });

      const data = await response.json();
      if (data) {
          console.log(chalk.cyan('Usage Information:'));
          console.log(chalk.dim('========================================'));

          // Display user usage in a table
          if (data.user && data.user.length > 0) {
              console.log(chalk.cyan('User Usage:'));
              console.log(chalk.dim('----------------------------------------'));
              console.log(
                  chalk.bold('Service'.padEnd(30)) +
                  chalk.bold('Implementation'.padEnd(20)) +
                  chalk.bold('Month'.padEnd(10)) +
                  chalk.bold('Usage'.padEnd(10)) +
                  chalk.bold('Limit'.padEnd(10)) +
                  chalk.bold('Rate Limit')
              );
              console.log(chalk.dim('----------------------------------------'));
              data.user.forEach(usage => {
                  const service = `${usage.service['driver.interface']}.${usage.service['driver.method']}`;
                  const implementation = usage.service['driver.implementation'];
                  const month = `${usage.month}/${usage.year}`;
                  const monthlyUsage = usage.monthly_usage?.toString();
                  const monthlyLimit = usage.monthly_limit ? usage.monthly_limit.toString() : 'No Limit';
                  const rateLimit = usage.policy ? `${usage.policy['rate-limit'].max} req/${usage.policy['rate-limit'].period / 1000}s` : 'N/A';

                  console.log(
                      service.padEnd(30) +
                      implementation.padEnd(20) +
                      month.padEnd(10) +
                      monthlyUsage.padEnd(10) +
                      monthlyLimit.padEnd(10) +
                      rateLimit
                  );
              });
              console.log(chalk.dim('----------------------------------------'));
          }

          // Display app usage in a table (if available)
          if (data.apps && Object.keys(data.apps).length > 0) {
              console.log(chalk.cyan('\nApp Usage:'));
              console.log(chalk.dim('----------------------------------------'));
              console.log(
                  chalk.bold('App'.padEnd(30)) +
                  chalk.bold('Usage'.padEnd(10)) +
                  chalk.bold('Limit'.padEnd(10))
              );
              console.log(chalk.dim('----------------------------------------'));
              for (const [app, usage] of Object.entries(data.apps)) {
                  console.log(
                      app.padEnd(30) +
                      usage.used.toString().padEnd(10) +
                      usage.available.toString().padEnd(10)
                  );
              }
              console.log(chalk.dim('----------------------------------------'));
          }

          // Display general usages in a table (if available)
          if (data.usages && data.usages.length > 0) {
              console.log(chalk.cyan('\nGeneral Usages:'));
              console.log(chalk.dim('----------------------------------------'));
              console.log(
                  chalk.bold('Name'.padEnd(30)) +
                  chalk.bold('Used'.padEnd(10)) +
                  chalk.bold('Available'.padEnd(10)) +
                  chalk.bold('Refill')
              );
              console.log(chalk.dim('----------------------------------------'));
              data.usages.forEach(usage => {
                  console.log(
                      usage.name.padEnd(30) +
                      usage.used.toString().padEnd(10) +
                      usage.available.toString().padEnd(10) +
                      usage.refill
                  );
              });
              console.log(chalk.dim('----------------------------------------'));
          }

          console.log(chalk.dim('========================================'));
          console.log(chalk.green('Done.'));
      } else {
          console.error(chalk.red('Unable to fetch usage information.'));
      }
  } catch (error) {
      console.error(chalk.red(`Failed to fetch usage information.\nError: ${error.message}`));
  }
}