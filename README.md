# Instagram Webhook Auto-Reply Server (Hono)

Node.js Hono server that receives Instagram message webhooks and auto-replies when specific keywords are matched.

---

## 🛠️ Requirements & Meta Setup Details

To make this server work, you need to configure things in the **Meta for Developers** console.

### 1. Facebook Page & Instagram Account Setup
- You need a **Facebook Page**.
- You need an **Instagram Professional Account (Business or Creator)**.
- Connect your Instagram account to the Facebook Page in Instagram Settings or Facebook Page Settings.

### 2. Meta Developer App Setup
1. Go to [Meta for Developers](https://developers.facebook.com/) and create a new **Business App**.
2. Add the **Instagram Graph API** product to your app.

### 3. Generate Page Access Token
Generate an Access Token for your Facebook Page (which is connected to your Instagram account) using the **Graph API Explorer** or app dashboard.
Ensure the token has these permissions:
- `instagram_basic`
- `instagram_manage_messages`
- `pages_manage_metadata`
- `pages_show_list`
- `pages_read_engagement`

Copy this token to `INSTAGRAM_PAGE_ACCESS_TOKEN` in your `.env`.

### 4. Configure Webhooks
1. In Meta App Settings, go to **Webhooks** under the App products.
2. Select **Instagram** from the dropdown menu.
3. Click **Subscribe to this object**.
4. Set the **Callback URL** to your server endpoint (e.g. `https://<your-subdomain>.ngrok-free.app/webhook`).
5. Set the **Verify Token** (must match `VERIFY_TOKEN` in your `.env`).
6. After verifying, subscribe to the **`messages`** event.

---

## 🚀 How to Run Locally

### 1. Configure `.env`
Create `.env` based on `.env.example`:
```env
PORT=3000
VERIFY_TOKEN=my_secure_verify_token
INSTAGRAM_PAGE_ACCESS_TOKEN=your_facebook_page_access_token_here
TRIGGER_KEYWORD=hello
REPLY_TEXT=Hello! This is an automated reply.
```

### 2. Install dependencies
```bash
npm install
```

### 3. Start Development Server
```bash
npm run dev
```

### 4. Expose Local Port (Optional for testing)
To test webhooks locally, expose port 3000 to the public internet:
```bash
ngrok http 3000
```
Use the HTTPS URL provided by ngrok as the Callback URL in Meta's Webhook configuration page.
