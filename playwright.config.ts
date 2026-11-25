import 'dotenv/config';
import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./e2e',workers:1,use:{baseURL:'http://127.0.0.1:3001',headless:true,browserName:process.env.ACCEPTANCE_BROWSER==='firefox'?'firefox':'chromium'},reporter:'list'});
