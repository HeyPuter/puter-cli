import inquirer from 'inquirer';
import chalk from 'chalk';
import Conf from 'conf';
import ora from 'ora';
import fetch from 'node-fetch';

export class PuterAuth {
  constructor(config = new Conf({ projectName: 'puter-cli' }), fetcher = fetch) {
    this.config = config;
    this.fetch = fetcher;
    this.baseUrl = 'https://puter.com';
  }

  async login(credentials = null) {
    let username, password;

    if (!credentials) {
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
      username = answers.username;
      password = answers.password;
    } else {
      username = credentials.username;
      password = credentials.password;
    }

    try {
      const response = await this.fetch(`${this.baseUrl}/login`, {
        method: 'POST',
        headers: {
          'Accept': '*/*',
          'Content-Type': 'application/json',
          'Origin': this.baseUrl,
          'Referer': this.baseUrl
        },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (data.proceed && data.token) {
        this.config.set('auth_token', data.token);
        this.config.set('username', username);
        return { success: true, token: data.token, username };
      }
      return { success: false, error: 'Invalid credentials' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async logout() {
    try {
      const token = this.config.get('auth_token');
      if (!token) {
        return { success: false, error: 'Not logged in' };
      }
      this.config.clear();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  isAuthenticated() {
    return !!this.config.get('auth_token');
  }

  getAuthToken() {
    return this.config.get('auth_token');
  }
}

// Create default instance for CLI usage
const defaultAuth = new PuterAuth();
export const login = defaultAuth.login.bind(defaultAuth);
export const logout = defaultAuth.logout.bind(defaultAuth);