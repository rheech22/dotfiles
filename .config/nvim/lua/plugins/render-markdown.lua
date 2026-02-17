return {
  config = function()
    require('render-markdown').setup {
      file_types = { 'markdown', 'vimwiki' },
      heading = {
        position = 'inline',
        icons = { '#₁ ', '#₂ ', '#₃ ', '#₄ ', '#₅ ', '#₆ ' },
        width = 'full',
        sign = false,
        border = false,
      },

      bullet = {
        icons = { '•', '◦', '‣', '-' },
      },
      checkbox = {
        checked = { icon = '• ✔︎' },
        unchecked = { icon = '• ▢' },
      },
      link = {
        image = '󰥶  ',
        email = '󰀓  ',
        hyperlink = '󰌹  ',
        wiki = {
          enabled = true,
          icon = '󱗖  ',
        },
        custom = {
          web = { pattern = '^http', icon = '󰖟  ' },
          apple = { pattern = 'apple%.com', icon = '  ' },
          discord = { pattern = 'discord%.com', icon = '󰙯  ' },
          github = { pattern = 'github%.com', icon = '󰊤  ' },
          gitlab = { pattern = 'gitlab%.com', icon = '󰮠  ' },
          google = { pattern = 'google%.com', icon = '󰊭  ' },
          hackernews = { pattern = 'ycombinator%.com', icon = '  ' },
          linkedin = { pattern = 'linkedin%.com', icon = '󰌻  ' },
          microsoft = { pattern = 'microsoft%.com', icon = '  ' },
          neovim = { pattern = 'neovim%.io', icon = '  ' },
          reddit = { pattern = 'reddit%.com', icon = '󰑍  ' },
          slack = { pattern = 'slack%.com', icon = '󰒱  ' },
          stackoverflow = { pattern = 'stackoverflow%.com', icon = '󰓌  ' },
          steam = { pattern = 'steampowered%.com', icon = '  ' },
          twitter = { pattern = 'twitter%.com', icon = '  ' },
          wikipedia = { pattern = 'wikipedia%.org', icon = '󰖬  ' },
          x = { pattern = 'x%.com', icon = '  ' },
          youtube = { pattern = 'youtube[^.]*%.com', icon = '󰗃  ' },
          youtube_short = { pattern = 'youtu%.be', icon = '󰗃  ' },
        },
      },
      code = {
        sign = false,
        width = 'block',
        left_pad = 2,
        right_pad = 4,
        border = 'thick',
      },
    }
  end,
}
