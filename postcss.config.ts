type PostCSSConfig = {
  plugins: {
    [key: string]: Record<string, any>
  }
}

const config: PostCSSConfig = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}

export default config