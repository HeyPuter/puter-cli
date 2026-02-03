// external
import inquirer from 'inquirer';
import Conf from 'conf';
import chalk from 'chalk';
import ora from 'ora';
import {getAuthToken} from "@heyputer/puter.js/src/init.cjs";

// project
import { BASE_URL, NULL_UUID, PROJECT_NAME, getHeaders, reconfigureURLs } from '../commons.js'

// builtin
import fs from 'node:fs';
import crypto from 'node:crypto';
import { initPuterModule } from './PuterModule.js';

// initializations
const config = new Conf({ projectName: PROJECT_NAME });

let profileModule;

function toApiSubdomain(inputUrl) {
    const url = new URL(inputUrl);
    const hostParts = url.hostname.split('.');

    // Insert 'api' before the domain
    hostParts.splice(-2, 0, 'api');
    url.hostname = hostParts.join('.');

    let output = url.toString();
    if (output.endsWith('/')) {
        output = output.slice(0, -1);
    }
    return output;
}

class ProfileModule {
    async checkLogin() {
        if (config.get('auth_token')) {
            this.migrateLegacyConfig();
        }
        if (!config.get('selected_profile')) {
            console.log(chalk.cyan('Please login first (or use CTRL+C to exit):'));
            await this.switchProfileWizard();
            // re init with new authToken
            initPuterModule();
        }
        this.applyProfileToGlobals();
    }
    migrateLegacyConfig() {
        const auth_token = config.get('auth_token');
        const username = config.get('username');

        this.addProfile({
            host: BASE_URL,
            username,
            cwd: `/${username}`,
            token: auth_token,
            uuid: NULL_UUID,
        });

        config.delete('auth_token');
        config.delete('username');
    }
    getDefaultProfile() {
        const auth_token = config.get('auth_token');
        if (!auth_token) return;
        return {
            host: 'puter.com',
            username: config.get('username'),
            token: auth_token,
        };
    }
    getProfiles() {
        const profiles = config.get('profiles') ?? [];
        return profiles;
    }
    addProfile(newProfile) {
        const profiles = [
            ...this.getProfiles().filter(p => !p.transient),
            newProfile,
        ];
        config.set('profiles', profiles);
    }
    selectProfile(profile) {
        config.set('selected_profile', profile.uuid);
        config.set('username', `${profile.username}`);
        config.set('cwd', `/${profile.username}`);
        this.applyProfileToGlobals(profile);
    }
    getCurrentProfile() {
        const profiles = this.getProfiles();
        const uuid = config.get('selected_profile');
        return profiles.find(p => p.uuid === uuid);
    }
    applyProfileToGlobals(profile) {
        if (!profile) profile = this.getCurrentProfile();
        reconfigureURLs({
            base: profile.host,
            api: toApiSubdomain(profile.host),
        });
    }
    getAuthToken() {
        const uuid = config.get('selected_profile');
        const profiles = this.getProfiles();
        const profile = profiles.find(v => v.uuid === uuid);
        return profile?.token;
    }

    async switchProfileWizard(args = {}) {
        const profiles = this.getProfiles();
        if (profiles.length < 1) {
            return this.addProfileWizard();
        }

        // console.log('doing this branch');
        const answer = await inquirer.prompt([
            {
                name: 'profile',
                type: 'list',
                message: 'Select a Profile',
                choices: [
                    ...profiles.map((v, i) => {
                        return {
                            name: v.name ?? `${v.username}@${v.host}`,
                            value: v,
                        };
                    }),
                    {
                        name: 'Create New Profile',
                        value: 'new',
                    }
                ]
            }
        ]);

        if (answer.profile === 'new') {
            return await this.addProfileWizard();
        }

        this.selectProfile(answer.profile);
    }

    async addProfileWizard(args = {}) {
        const answers = await inquirer.prompt([
            {
                type: 'input',
                name: 'host',
                message: 'Host (leave blank for puter.com):',
                default: 'https://puter.com',
                validate: input => input.length >= 1 || 'Host is required'
            },
            {
                type: 'input',
                name: 'username',
                message: 'Username:',
                validate: input => input.length >= 1 || 'Username is required'
            },
        ]);

        let spinner;
        try {
            spinner = ora('Logging in to Puter...').start();
            const authToken = await getAuthToken();

            if (authToken) {
                const profileUUID = crypto.randomUUID();
                const profile = {
                    host: answers.host,
                    username: answers.username,
                    cwd: `/${answers.username}`,
                    token: authToken,
                    uuid: profileUUID,
                };
                this.addProfile(profile);
                this.selectProfile(profile);
                if (spinner) {
                    spinner.succeed(chalk.green('Successfully logged in to Puter!'));
                }
                // Save token
                if (args.save) {
                    const localEnvFile = '.env';
                    try {
                        // Check if the file exists, if so then append the api key to the EOF.
                        if (fs.existsSync(localEnvFile)) {
                            console.log(chalk.yellow(`File "${localEnvFile}" already exists... Adding token.`));
                            fs.appendFileSync(localEnvFile, `\nPUTER_API_KEY="${authToken}"`, 'utf8');
                        } else {
                            console.log(chalk.cyan(`Saving token to ${chalk.green(localEnvFile)} file.`));
                            fs.writeFileSync(localEnvFile, `PUTER_API_KEY="${authToken}"`, 'utf8');
                        }
                    } catch (error) {
                        console.error(chalk.red(`Cannot save token to .env file. Error: ${error.message}`));
                        console.log(chalk.cyan(`PUTER_API_KEY="${authToken}"`));
                    }
                }
            } else {
                spinner.fail(chalk.red('Login failed. Please check your credentials.'));
            }
        } catch (error) {
            if (spinner) {
                spinner.fail(chalk.red(`Failed to login: ${error.message}`));
                console.log(error);
            } else {
                console.error(chalk.red(`Failed to login: ${error.message}`));
            }
        }
    }
}

export const initProfileModule = () => {
    profileModule = new ProfileModule();
}

/**
 * Get ProfileModule object
 * @returns {ProfileModule} ProfileModule - ProfileModule Object.
 */
export const getProfileModule = () => {
    if (!profileModule) {
        throw new Error("Call initprofileModule() first");
    }
    return profileModule;
}
