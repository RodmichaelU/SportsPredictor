This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

Requires Node 20.9+ (Next.js 16). If your system Node is older, install one via `brew install node@20` and `export PATH="/opt/homebrew/opt/node@20/bin:$PATH"` before running the commands below, or use `nvm use` (see `.nvmrc`).

`lib/api.ts` calls the real FastAPI backend (`../api/main.py`) when `NEXT_PUBLIC_API_URL` is set (see `.env.local`, gitignored), and falls back to typed mock data in `lib/mockData.ts` otherwise — useful for UI work without the backend running. To see real predictions:

```bash
# from the repo root, in another terminal
source .venv/bin/activate
uvicorn api.main:app --port 8000
```

`.env.local` already points `NEXT_PUBLIC_API_URL` at `http://localhost:8000`.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
