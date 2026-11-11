This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

Requires Node 20.9+ (Next.js 16). If your system Node is older, install one via `brew install node@20` and `export PATH="/opt/homebrew/opt/node@20/bin:$PATH"` before running the commands below, or use `nvm use` (see `.nvmrc`).

The site is a static export (`output: "export"`): every page is pre-built from JSON files that `python -m src.export_static` writes to `public/data/`, and `lib/api.ts` reads those at build time. With no export present it falls back to typed mock data in `lib/mockData.ts` (useful for UI work). To see real data:

```bash
# from the repo root
.venv/bin/python -m src.export_static
```

Then run the dev server below. Browser-side code (the model curve explorer, the parlay rater) uses `lib/clientData.ts` and `lib/parlayRating.js` instead of `lib/api.ts`, which reads the filesystem. Deployment is covered in [../deploy/README.md](../deploy/README.md).

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
