// external
import inquirer from 'inquirer';
import Conf from 'conf';
import chalk from 'chalk';
import ora from 'ora';
import {getAuthToken} from "@heyputer/puter.js/src/init.cjs";
import { puter } from "@heyputer/puter.js";

// project
import { HOME, PROJECT_NAME, getHeaders, reconfigureURLs, setHomePath } from '../commons.js'

// builtin
import fs from 'node:fs';
import { initPuterModule } from './PuterModule.js';
import { isAuthError } from './ErrorModule.js';

// initializations
const config = new Conf({ projectName: PROJECT_NAME });

// Outcomes of a session check against the server.
const SESSION_OK = 'ok';            // token works; identity refreshed
const SESSION_INVALID = 'invalid';  // token rejected; the user must log in again
const SESSION_UNKNOWN = 'unknown';  // unreachable or unexpected reply; assume usable

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
        if (!config.get('selected_profile')) {
            console.log(chalk.cyan('Please login first (or use CTRL+C to exit):'));
            await this.switchProfileWizard();
            // re init with new authToken
            initPuterModule();
        }
        this.applyProfileToGlobals();

        if (await this.refreshIdentity() === SESSION_INVALID) {
            console.log(chalk.yellow('Your session has expired or its token is no longer valid.'));
            console.log(chalk.cyan('Please log in again (or use CTRL+C to exit):'));
            this.dropCurrentProfile();
            await this.switchProfileWizard();
            initPuterModule();
            this.applyProfileToGlobals();
        }
    }

    /**
     * Forget the selected profile, whose token the server has rejected. Keeping
     * a dead token around only makes the next command fail the same way.
     */
    dropCurrentProfile() {
        const selected = config.get('selected_profile');
        config.set('profiles', this.getProfiles().filter(p => p.uuid !== selected));
        config.delete('selected_profile');
        config.delete('username');
        config.delete('cwd');
    }


    /**
     * Re-read the identity from the server using the current token.
     *
     * A username is a mutable display label that the user can change at any
     * time; the token is the identity. Nothing may depend on the cached username
     * beyond display, and the cache is refreshed here on every run so it never
     * silently drifts.
     */
    async refreshIdentity() {
        const profile = this.getCurrentProfile();
        if (!profile?.token) return SESSION_INVALID;

        try {
            puter.setAuthToken(profile.token);
            const userInfo = await puter.auth.getUser();
            if (!userInfo?.username) return SESSION_UNKNOWN;

            if (userInfo.username !== profile.username) {
                this.rehomePaths(profile.username, userInfo.username);
                this.updateProfile(profile.uuid, { username: userInfo.username });
            }
            setHomePath(`/${userInfo.username}`);
            return SESSION_OK;
        } catch (error) {
            // A rejected token will not start working again, so say so and let
            // the caller re-authenticate.
            if (isAuthError(error)) return SESSION_INVALID;

            // Offline or a transient API failure. Keep the cached label and
            // carry on rather than forcing a login the user cannot complete.
            return SESSION_UNKNOWN;
        }
    }


    /**
     * Ask the server who a token belongs to.
     * @param {string} token - The auth token to identify
     * @returns {Promise<{username: string, uuid: string}>} The account identity
     */
    async fetchIdentity(token) {
        puter.setAuthToken(token);
        const userInfo = await puter.auth.getUser();
        if (!userInfo?.username) {
            throw new Error('The server did not return an account for this token.');
        }
        return userInfo;
    }

    /**
     * The selected profile's current working directory.
     * @returns {string} The stored cwd, or the home directory as a fallback
     */
    getCwd() {
        return this.getCurrentProfile()?.cwd || HOME;
    }

    /**
     * Record the selected profile's current working directory.
     * @param {string} cwd - The new working directory
     */
    setCwd(cwd) {
        const profile = this.getCurrentProfile();
        if (profile) this.updateProfile(profile.uuid, { cwd });
    }

    /**
     * Merge a patch into a stored profile, matched by its id.
     * @param {string} profileId - The `uuid` of the profile to patch
     * @param {Object} patch - Fields to merge into the profile
     */
    updateProfile(profileId, patch) {
        const profiles = this.getProfiles().map(p => (
            p.uuid === profileId ? { ...p, ...patch } : p
        ));
        config.set('profiles', profiles);
    }
    getProfiles() {
        const profiles = config.get('profiles') ?? [];
        return profiles;
    }
    addProfile(newProfile) {
        const profiles = [
            // Profiles are keyed by account id, so re-authenticating replaces the
            // existing entry rather than adding a second one for the same account.
            ...this.getProfiles().filter(p => !p.transient && p.uuid !== newProfile.uuid),
            newProfile,
        ];
        config.set('profiles', profiles);
    }
    selectProfile(profile) {
        config.set('selected_profile', profile.uuid);
        if (!profile.cwd) {
            this.updateProfile(profile.uuid, { cwd: `/${profile.username}` });
        }
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
        // Provisional home from the cached label, so paths resolve before the
        // network round-trip; refreshIdentity() re-points it at the live value.
        setHomePath(`/${profile.username}`);
    }

    /**
     * Re-point any stored path that lives under the old home directory at the
     * new one, after the account was renamed.
     *
     * Only the home prefix is rewritten: a cwd under some other user's tree is
     * left alone, since that path did not move.
     *
     * @param {string} oldUsername - The username the paths were written with
     * @param {string} newUsername - The account's current username
     */
    rehomePaths(oldUsername, newUsername) {
        if (!oldUsername || oldUsername === newUsername) return;

        const oldHome = `/${oldUsername}`;
        const newHome = `/${newUsername}`;
        const rehome = p => (
            p === oldHome || p?.startsWith(`${oldHome}/`)
                ? `${newHome}${p.slice(oldHome.length)}`
                : p
        );

        const profile = this.getCurrentProfile();
        if (profile?.cwd) {
            this.updateProfile(profile.uuid, { cwd: rehome(profile.cwd) });
        }
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

            const profile = {
                host,
                // Display label only; re-resolved from the token on every run.
                username: userInfo.username,
                cwd: `/${userInfo.username}`,
                token: authToken,
                // The account's own id, as reported by the server.
                uuid: userInfo.uuid,
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
                    await this.createProfileFromToken(otpData.token, answers.username, host, spinner, save);
                } else {
                    spinner.fail(chalk.red('2FA verification failed.'));
                }
            } else if (data.token) {
                await this.createProfileFromToken(data.token, answers.username, host, spinner, save);
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

    async createProfileFromToken(token, username, host, spinner, save) {
        // The server is the authority on both the account id and the spelling of
        // the username, so ask it rather than trusting what was typed.
        const userInfo = await this.fetchIdentity(token);
        const profile = {
            host,
            // Display label only; re-resolved from the token on every run.
            username: userInfo.username,
            cwd: `/${userInfo.username}`,
            token,
            // The account's own id, as reported by the server.
            uuid: userInfo.uuid,
        };

        this.addProfile(profile);
        this.selectProfile(profile);
        spinner.succeed(chalk.green(`Successfully logged in as ${userInfo.username}!`));

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
