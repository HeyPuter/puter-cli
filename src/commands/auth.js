import fs from 'node:fs';
import inquirer from 'inquirer';
import chalk from 'chalk';
import Conf from 'conf';
import ora from 'ora';
import fetch from 'node-fetch';
import { PROJECT_NAME, API_BASE, getHeaders, BASE_URL } from '../commons.js'
import { ProfileAPI } from '../modules/ProfileModule.js';
import { get_context } from '../temporary/context_helpers.js';
import { getPuter } from '../modules/PuterModule.js';
const config = new Conf({ projectName: PROJECT_NAME });

/**
 * Login user
 * @returns void
 */
export async function login(args = {}, context) {
  const profileAPI = context[ProfileAPI];
  await profileAPI.switchProfileWizard();
}

/**
 * Logout user
 * @returns void
 */
export async function logout() {
  
  let spinner;
  try {
    spinner = ora('Logging out from Puter...').start();
    const token = config.get('auth_token');
    const selected_profile = config.get('selected_profile');

    if (token) {
      // legacy auth
      config.clear();
      spinner.succeed(chalk.green('Successfully logged out from Puter!'));
    } else if (selected_profile) {
      // multi profile auth
      config.delete('selected_profile');
      config.delete('username');
      config.delete('cwd');

      const profiles = config.get('profiles');
      config.set('profiles', profiles.filter(profile => profile.uuid != selected_profile));
      spinner.succeed(chalk.green('Successfully logged out from Puter!'));
    } else {
      spinner.info(chalk.yellow('Already logged out'));
    }
  } catch (error) {
    if (spinner){
      spinner.fail(chalk.red('Failed to logout'));
    }
    console.error(chalk.red(`Error: ${error.message}`));
  }
}

export async function getUserInfo() {
  console.log(chalk.green('Getting user info...\n'));
  const puter = getPuter();
  try {
    const data = await puter.auth.getUser();
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
    console.log(error);
  }
}
export function isAuthenticated() {
  return !!config.get('auth_token');
}

export function getAuthToken() {
  const context = get_context();
  const profileAPI = context[ProfileAPI];
  return profileAPI.getAuthToken();
}

export function getCurrentUserName() {
  const context = get_context();
  const profileAPI = context[ProfileAPI];
  return profileAPI.getCurrentProfile()?.username;
}

export function getCurrentDirectory() {
  return config.get('cwd');
}

/**
 * Fetch usage information
 */
export async function getUsageInfo() {
  console.log(chalk.green('Fetching usage information...\n'));
  const puter = getPuter();
  try {
      const data = await puter.auth.getMonthlyUsage();
      if (data) {
          // Display allowance information
          if (data.allowanceInfo) {
              console.log(chalk.cyan('Allowance Information:'));
              console.log(chalk.dim('='.repeat(100)));
              console.log(chalk.cyan(`Month Usage Allowance: `) + chalk.white(data.allowanceInfo.monthUsageAllowance.toLocaleString()));
              console.log(chalk.cyan(`Remaining: `) + chalk.white(data.allowanceInfo.remaining.toLocaleString()));
              const usedPercentage = ((data.allowanceInfo.monthUsageAllowance - data.allowanceInfo.remaining) / data.allowanceInfo.monthUsageAllowance * 100).toFixed(2);
              console.log(chalk.cyan(`Used: `) + chalk.white(`${usedPercentage}%`));
              console.log(chalk.dim('='.repeat(100)));
          }

          // Display usage information per API
          if (data.usage) {
              console.log(chalk.cyan('\nAPI Usage:'));
              console.log(chalk.dim('='.repeat(100)));
              console.log(
                  chalk.bold('API'.padEnd(50)) +
                  chalk.bold('Count'.padEnd(15)) +
                  chalk.bold('Cost'.padEnd(20)) +
                  chalk.bold('Units')
              );
              console.log(chalk.dim('='.repeat(100)));

              // Filter out 'total' and sort entries by cost (descending)
              const usageEntries = Object.entries(data.usage)
                  .filter(([key]) => key !== 'total')
                  .sort(([, a], [, b]) => b.cost - a.cost);

              usageEntries.forEach(([api, details]) => {
                  console.log(
                      api.padEnd(50) +
                      details.count.toString().padEnd(15) +
                      details.cost.toLocaleString().padEnd(20) +
                      details.units.toLocaleString()
                  );
              });

              // Display total if available
              if (data.usage.total !== undefined) {
                  console.log(chalk.dim('='.repeat(100)));
                  console.log(
                      chalk.bold('TOTAL'.padEnd(50)) +
                      ''.padEnd(15) +
                      chalk.bold(data.usage.total.toLocaleString())
                  );
              }
              console.log(chalk.dim('='.repeat(100)));
          }

          // Display app totals
          if (data.appTotals && Object.keys(data.appTotals).length > 0) {
              console.log(chalk.cyan('\nApp Totals:'));
              console.log(chalk.dim('='.repeat(100)));
              console.log(
                  chalk.bold('App'.padEnd(50)) +
                  chalk.bold('Count'.padEnd(15)) +
                  chalk.bold('Total')
              );
              console.log(chalk.dim('='.repeat(100)));

              // Sort by total (descending)
              const appEntries = Object.entries(data.appTotals)
                  .sort(([, a], [, b]) => b.total - a.total);

              appEntries.forEach(([app, details]) => {
                  console.log(
                      app.padEnd(50) +
                      details.count.toString().padEnd(15) +
                      details.total.toLocaleString()
                  );
              });
              console.log(chalk.dim('='.repeat(100)));
          }
          console.log(chalk.green('Done.'));
      } else {
          console.error(chalk.red('Unable to fetch usage information.'));
      }
  } catch (error) {
      console.error(chalk.red(`Failed to fetch usage information.\nError: ${error.message}`));
  }
}