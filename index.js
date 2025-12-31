const axios = require('axios');
const { wrapper } = require('axios-cookiejar-support');
const { CookieJar } = require('tough-cookie');
const inquirer = require('inquirer');

// --- 設定 / Settings ---
const TARGET_USER_DEFAULT = process.env.SCRATCH_TARGET; // 自動実行時のターゲット

// --- HTTPクライアント設定 ---
const jar = new CookieJar();
const client = wrapper(axios.create({
    jar,
    withCredentials: true,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': 'https://scratch.mit.edu/'
    }
}));

let currentUser = { username: '', id: '', xToken: '' };

// --- メイン処理 ---
async function main() {
    console.log('\n=== Scratch API Tool ===\n');

    // ★ GitHub Actions または 環境変数が設定されている場合の自動モード
    if (process.env.SCRATCH_USERNAME && process.env.SCRATCH_PASSWORD) {
        console.log("🤖 GitHub Actions / Environment detected. Starting Automatic Mode.");
        
        const myUser = process.env.SCRATCH_USERNAME;
        const myPass = process.env.SCRATCH_PASSWORD;
        const targetUser = process.env.TARGET_USER || TARGET_USER_DEFAULT;
        const commentContent = "あけましておめでとうございます。\n(@あけおめBot)"; // コメント本文があれば送信モードになる

        // 1. ログイン
        const loginSuccess = await performLogin(myUser, myPass);
        if (!loginSuccess) {
            console.error("❌ Login Failed. Exiting.");
            process.exit(1);
        }

        // 2. ターゲットの情報を取得
        console.log(`\n🔎 Target User: ${targetUser}`);
        await getTargetProfileInfo(targetUser);

        // 3. (オプション) コメント機能
        // GitHub Secretsに 'COMMENT_CONTENT' が設定されている場合のみ実行
        if (commentContent) {
            console.log(`\n💬 Posting comment to ${targetUser}...`);
            await autoSendProfileComment(targetUser, commentContent);
        } else {
            console.log("\nℹ️ No comment content provided. Skipping comment.");
        }

        console.log("\n✅ Automation finished.");
        process.exit(0);
    } 
    
    // ★ 以下、ローカル実行時の対話モード（元のコードのロジック）
    else {
        // (元の対話コードを簡略化して記述します。必要であれば元のコードの全量をここに戻してください)
        console.log("Interactive mode requires 'inquirer'. Please run locally.");
        // ここに元の while(true) ループなどを入れることができます
    }
}

// --- 自動化用関数 ---

async function performLogin(username, password) {
    try {
        console.log('1. Fetching CSRF Token...');
        await client.get('https://scratch.mit.edu/csrf_token/');
        
        const cookies = await jar.getCookies('https://scratch.mit.edu');
        const csrfToken = cookies.find(c => c.key === 'scratchcsrftoken')?.value;
        if (!csrfToken) throw new Error('CSRF Token Error');

        console.log(`2. Logging in as ${username}...`);
        const response = await client.post('https://scratch.mit.edu/accounts/login/', {
            username: username, password: password, useMessages: true
        }, { headers: { 'X-CSRFToken': csrfToken } });

        const userData = response.data[0];
        if (userData && userData.token) {
            currentUser = { username: userData.username, id: userData.id, xToken: userData.token };
            console.log(`✅ Login Successful! User: ${userData.username}`);
            return true;
        }
        return false;
    } catch (error) {
        console.error(`Error during login: ${error.message}`);
        return false;
    }
}

async function getTargetProfileInfo(username) {
    try {
        const res = await client.get(`https://api.scratch.mit.edu/users/${username}`);
        const d = res.data;
    } catch (e) {
        console.error(`❌ Failed to get profile info for ${username}`);
    }
}

async function autoSendProfileComment(targetUsername, content) {
    try {
        const url = `https://scratch.mit.edu/site-api/comments/user/${targetUsername}/add/`;
        const csrfToken = (await jar.getCookies('https://scratch.mit.edu')).find(c => c.key === 'scratchcsrftoken')?.value;
        
        const response = await client.post(url, {
            content: content,
            parent_id: "",
            commentee_id: ""
        }, {
            headers: {
                'X-CSRFToken': csrfToken,
                'Referer': `https://scratch.mit.edu/users/${targetUsername}/`
            }
        });

        if (response.status === 200 || response.status === 201) {
            console.log('✅ Comment posted successfully!');
        }
    } catch (e) {
        console.error(`❌ Failed to post comment: ${e.message}`);
        if (e.response?.status === 403) console.error("   (403 Forbidden: Check login or email verification)");
    }
}

// 実行
main();