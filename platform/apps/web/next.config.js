/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    // On the landing SWA (prod), redirect / to /corporate
    if (process.env.NEXT_PUBLIC_SITE_MODE !== 'app') {
      return [
        {
          source: '/',
          destination: '/corporate',
          permanent: false,
        },
      ];
    }
    return [];
  },
};
module.exports = nextConfig;
