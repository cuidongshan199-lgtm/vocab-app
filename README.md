# Vocabulary — 英语背单词 App

智能英语背单词应用，支持跨设备云端同步、PWA 安装、六种题型。

## 🚀 快速开始（3 步部署）

### 1. 注册 Supabase（数据库）

1. 打开 [supabase.com](https://supabase.com) → **Start your project**（用 GitHub 登录最快）
2. 创建新项目：名称随意，设置数据库密码（记下来），区域选 **Asia** 附近
3. 等 1 分钟项目初始化完成
4. 进入 **SQL Editor** → **New query**
5. 复制 [schema.sql](schema.sql) 的全部内容 → 粘贴 → **Run**
6. 进入 **Project Settings** → **API**
7. 复制 **Project URL** 和 **anon public key**

### 2. 配置代码

打开 `index.html`，找到第 ~850 行：

```javascript
const SUPABASE_URL = 'YOUR_SUPABASE_URL';      // ← 粘贴 Project URL
const SUPABASE_KEY = 'YOUR_SUPABASE_ANON_KEY';  // ← 粘贴 anon public key
```

### 3. 部署到 Vercel（免费）

1. 打开 [vercel.com](https://vercel.com) → **Sign Up**（用 GitHub 登录）
2. **Add New** → **Project**
3. 导入这个文件夹
4. 点击 **Deploy**
5. 获得一个 `https://xxx.vercel.app` 网址

**完成！** 任何设备打开这个网址就能用了。

---

## 📱 安装到手机/桌面（PWA）

- **iPhone/iPad**：Safari 打开网址 → 点击分享按钮 → **添加到主屏幕**
- **Android**：Chrome 打开网址 → 菜单 → **添加到主屏幕**
- **电脑**：Chrome 地址栏右侧会出现安装图标

---

## 🔧 本地开发

```bash
# 用任意 HTTP 服务器启动（不能直接打开 HTML 文件，PWA 需要 HTTPS）
npx serve .
# 或
python -m http.server 8000
```

---

## 📦 数据同步说明

- 登录后所有单词自动云端存储
- 换设备登录同一账号 → 数据自动同步
- 离线时使用本地缓存，联网后自动同步
- 随时可以导出 JSON 备份

---

## 🗄️ 数据库结构

| 表 | 说明 |
|---|------|
| `words` | 单词数据，按 user_id 隔离 |
| `user_state` | 学习状态（打卡、复习记录等） |

所有表启用 RLS（行级安全），用户只能访问自己的数据。
