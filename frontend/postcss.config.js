import tailwindcss from 'tailwindcss'

let autoprefixerPlugin
try {
  const m = await import('autoprefixer')
  autoprefixerPlugin = m.default || m
} catch (e) {
  autoprefixerPlugin = null
}

export default {
  plugins: [
    tailwindcss,
    ...(autoprefixerPlugin ? [autoprefixerPlugin] : []),
  ],
}
