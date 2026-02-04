// external
import inquirer from 'inquirer';
import Conf from 'conf';
import chalk from 'chalk';
import ora from 'ora';
import {getAuthToken} from "@heyputer/puter.js/src/init.cjs";
import { puter } from "@heyputer/puter.js";

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
            return this.addProfileWizard(args);
        }

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
            return await this.addProfileWizard(args);
        }

        this.selectProfile(answer.profile);
    }

    async addProfileWizard(args = {}) {
        const host = args.host || 'https://puter.com';

        if (args.withCredentials) {
            return await this.credentialLogin({ ...args, host });
        }

        // Browser-based login (default)
        return await this.browserLogin({ ...args, host });
    }

    async browserLogin(args) {
        const { host, save } = args;
        const TIMEOUT_MS = 60000; // 1 minute timeout
        let spinner;

        try {
            spinner = ora('Opening browser for login...').start();

            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Login timed out after 60 seconds')), TIMEOUT_MS);
            });

            const authToken = await Promise.race([
                getAuthToken(),
                timeoutPromise
            ]);

            if (!authToken) {
                spinner.fail(chalk.red('Login failed or was cancelled.'));
                return;
            }

            spinner.text = 'Fetching user info...';

            // Set token and fetch user info
            puter.setAuthToken(authToken);
            const userInfo = await puter.auth.getUser();

            const profileUUID = crypto.randomUUID();
            const profile = {
                host,
                username: userInfo.username,
                cwd: `/${userInfo.username}`,
                token: authToken,
                uuid: profileUUID,
            };

            this.addProfile(profile);
            this.selectProfile(profile);
            spinner.succeed(chalk.green(`Successfully logged in as ${userInfo.username}!`));

            // Handle --save option
            this.saveTokenToEnv(authToken, save);
        } catch (error) {
            if (spinner) {
                spinner.fail(chalk.red(`Failed to login: ${error.message}`));
            } else {
                console.error(chalk.red(`Failed to login: ${error.message}`));
            }
        }
    }

    async credentialLogin(args) {
        const { host, save } = args;

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

        let spinner;
        try {
            spinner = ora('Logging in to Puter...').start();

            const apiHost = toApiSubdomain(host);
            const response = await fetch(`${apiHost}/login`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({
                    username: answers.username,
                    password: answers.password,
                }),
            });

            const data = await response.json();

            if (data.proceed && data.next_step === 'otp') {
                // Handle 2FA
                spinner.stop();
                const otpAnswer = await inquirer.prompt([
                    {
                        type: 'input',
                        name: 'otp',
                        message: 'Enter your 2FA code:',
                        validate: input => input.length >= 1 || '2FA code is required'
                    }
                ]);

                spinner = ora('Verifying 2FA code...').start();
                const otpResponse = await fetch(`${apiHost}/login/otp`, {
                    method: 'POST',
                    headers: getHeaders(),
                    body: JSON.stringify({
                        token: data.otp_jwt_token,
                        code: otpAnswer.otp,
                    }),
                });

                const otpData = await otpResponse.json();

                if (otpData.token) {
                    this.createProfileFromToken(otpData.token, answers.username, host, spinner, save);
                } else {
                    spinner.fail(chalk.red('2FA verification failed.'));
                }
            } else if (data.token) {
                this.createProfileFromToken(data.token, answers.username, host, spinner, save);
            } else {
                spinner.fail(chalk.red(data.error?.message || 'Login failed. Please check your credentials.'));
            }
        } catch (error) {
            if (spinner) {
                spinner.fail(chalk.red(`Failed to login: ${error.message}`));
            } else {
                console.error(chalk.red(`Failed to login: ${error.message}`));
            }
        }
    }

    createProfileFromToken(token, username, host, spinner, save) {
        const profileUUID = crypto.randomUUID();
        const profile = {
            host,
            username,
            cwd: `/${username}`,
            token,
            uuid: profileUUID,
        };

        this.addProfile(profile);
        this.selectProfile(profile);
        spinner.succeed(chalk.green(`Successfully logged in as ${username}!`));

        // Handle --save option
        this.saveTokenToEnv(token, save);
    }

    saveTokenToEnv(token, save) {
        if (!save) return;

        const localEnvFile = '.env';
        try {
            if (fs.existsSync(localEnvFile)) {
                console.log(chalk.yellow(`File "${localEnvFile}" already exists... Adding token.`));
                fs.appendFileSync(localEnvFile, `\nPUTER_API_KEY="${token}"`, 'utf8');
            } else {
                console.log(chalk.cyan(`Saving token to ${chalk.green(localEnvFile)} file.`));
                fs.writeFileSync(localEnvFile, `PUTER_API_KEY="${token}"`, 'utf8');
            }
        } catch (error) {
            console.error(chalk.red(`Cannot save token to .env file. Error: ${error.message}`));
            console.log(chalk.cyan(`PUTER_API_KEY="${token}"`));
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
