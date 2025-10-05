// external
import inquirer from 'inquirer';
import Conf from 'conf';
import chalk from 'chalk';
import ora from 'ora';

// project
import { API_BASE, BASE_URL, NULL_UUID, PROJECT_NAME, getHeaders, reconfigureURLs } from '../commons.js'
import { getAuthToken, login } from '../commands/auth.js';

// builtin
import fs from 'node:fs';
import crypto from 'node:crypto';

// initializations
const config = new Conf({ projectName: PROJECT_NAME });

export const ProfileAPI = Symbol('ProfileAPI');

function toApiSubdomain(inputUrl) {
    const url = new URL(inputUrl);
    const hostParts = url.hostname.split('.');
    
    // Insert 'api' before the domain
    hostParts.splice(-2, 0, 'api');
    url.hostname = hostParts.join('.');

    let output = url.toString();
    if ( output.endsWith('/') ) {
        output = output.slice(0, -1);
    }
    return output;
}

class ProfileModule {
    constructor({ context }) {
        this.context = context;

        context.events.on('check-login', async () => {
            if ( config.get('auth_token') ) {
                await this.migrateLegacyConfig();
            }
            if ( ! config.get('selected_profile') ) {
                console.log(chalk.cyan('Please login first (or use CTRL+C to exit):'));
                await this.switchProfileWizard();
                console.log(chalk.red('Please run "puter" command again (issue #11)'));
                process.exit(0);
            }
            this.applyProfileToGlobals();
        });

    }
    migrateLegacyConfig () {
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
        if ( ! auth_token ) return;
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
            ...this.getProfiles().filter(p => ! p.transient),
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
        if ( ! profile ) profile = this.getCurrentProfile();
        reconfigureURLs({
            base: profile.host,
            api: toApiSubdomain(profile.host),
        });
    }
    getAuthToken () {
        const uuid = config.get('selected_profile');
        const profiles = this.getProfiles();
        const profile = profiles.find(v => v.uuid === uuid);
        return profile?.token;
    }
    
    async switchProfileWizard (args = {}) {
        const profiles = this.getProfiles();
        if ( profiles.length < 1 ) {
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
        
        if ( answer.profile === 'new' ) {
            return await this.addProfileWizard();
        }
        
        this.selectProfile(answer.profile);
    }

    async addProfileWizard (args = {}) {
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

            const response = await fetch(`${answers.host}/login`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({
                    username: answers.username,
                    password: answers.password
                })
            });


            const contentType = response.headers.get('content-type');
            //console.log('content type?', '|' + contentType + '|');

            // TODO: proper content type parsing
            if ( ! contentType.trim().startsWith('application/json') ) {
                throw new Error(await response.text());
            }

            let data = await response.json();

            while (data.proceed && data.next_step) {
                if (data.next_step === 'otp') {
                    spinner.succeed(chalk.green('2FA is enabled'));
                    const answers2FA = await inquirer.prompt([
                        {
                            type: 'input',
                            name: 'otp',
                            message: 'Authenticator Code:',
                            validate: input => input.length === 6 || 'OTP must be 6 digits'
                        }
                    ]);
                    spinner = ora('Logging in to Puter...').start();
                    const response = await fetch(`${answers.host}/login/otp`, {
                        method: 'POST',
                        headers: getHeaders(),
                        body: JSON.stringify({
                            token: data.otp_jwt_token,
                            code: answers2FA.otp,
                        }),
                    });
                    data = await response.json();
                    continue;
                }

                if (data.next_step === 'complete') break;

                spinner.fail(chalk.red(`Unrecognized login step "${data.next_step}"; you might need to update puter-cli.`));
                return;
            }

            if (data.proceed && data.token) {
                const profileUUID = crypto.randomUUID();
                const profile = {
                    host: answers.host,
                    username: answers.username,
                    cwd: `/${answers.username}`,
                    token: data.token,
                    uuid: profileUUID,
                };
                this.addProfile(profile);
                this.selectProfile(profile);
                if (spinner) {
                    spinner.succeed(chalk.green('Successfully logged in to Puter!'));
                }
                console.log(chalk.dim(`Token: ${data.token.slice(0, 5)}...${data.token.slice(-5)}`));
                // Save token
                if (args.save) {
                    const localEnvFile = '.env';
                    try {
                        // Check if the file exists, if so then append the api key to the EOF.
                        if (fs.existsSync(localEnvFile)) {
                            console.log(chalk.yellow(`File "${localEnvFile}" already exists... Adding token.`));
                            fs.appendFileSync(localEnvFile, `\nPUTER_API_KEY="${data.token}"`, 'utf8');
                        } else {
                            console.log(chalk.cyan(`Saving token to ${chalk.green(localEnvFile)} file.`));
                            fs.writeFileSync(localEnvFile, `PUTER_API_KEY="${data.token}"`, 'utf8');
                        }
                    } catch (error) {
                        console.error(chalk.red(`Cannot save token to .env file. Error: ${error.message}`));
                        console.log(chalk.cyan(`PUTER_API_KEY="${data.token}"`));
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

export default ({ context }) => {
    const module = new ProfileModule({ context });
    context[ProfileAPI] = module;
};
