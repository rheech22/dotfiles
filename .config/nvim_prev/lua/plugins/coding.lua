return {
  -- https://www.lazyvim.org/extras/coding/blink
  {
    "saghen/blink.cmp",
    opts = {
      completion = {
        menu = { border = "single", auto_show = true },
        documentation = { window = { border = "single" } },
        ghost_text = { enabled = false },
      },
    },
  },

  -- lua with lazy.nvim
  {
    "max397574/better-escape.nvim",
    config = function()
      require("better_escape").setup()
    end,
  },

  -- https://github.com/smjonas/inc-rename.nvim
  {
    "smjonas/inc-rename.nvim",
    cm = "IncRename",
    config = true,
  },

  --  https://github.com/nvim-telescope/telescope.nvim
  {
    "nvim-telescope/telescope.nvim",
    tag = "0.1.8",
    dependencies = { "nvim-lua/plenary.nvim" },
    config = function()
      require("telescope").load_extension("flutter")
      vim.keymap.set("n", "fl", '<cmd>lua require("telescope").extensions.flutter.commands()<cr>')
    end,
  },

  -- https://github.com/nvim-flutter/flutter-tools.nvim
  {
    "akinsho/flutter-tools.nvim",
    lazy = false,
    dependencies = {
      "nvim-lua/plenary.nvim",
    },
    config = function()
      require("flutter-tools").setup({
        -- flutter_path = "dirname $(which flutter)",

        ui = {
          border = "rounded",
          notification_style = "native",
        },

        decorations = {
          statusline = {
            app_version = true,
            device = true,
            project_config = true,
          },
        },

        root_patterns = { ".git", "pubspec.yaml" }, -- patterns to find the root of your flutter project

        fvm = true, -- takes priority over path, uses <workspace>/.fvm/flutter_sdk if enabled

        widget_guides = {
          enabled = true,
        },

        closing_tags = {
          highlight = "Comment", -- highlight for the closing tag
          prefix = "//", -- character to use for close tag e.g. > Widget
          enabled = true, -- set to false to disable
        },

        dev_log = {
          enabled = false,
          notify_errors = false, -- if there is an error whilst running then notify the user
          open_cmd = "15split", -- command to us
        },

        dev_tools = {
          autostart = false, -- autostart devtools server if not detected
          auto_open_browser = false, -- Automatically opens devtools in the browser
        },

        outline = {
          open_cmd = "30vnew", -- command to use to open the outline buffer
          auto_open = false, -- if true this will open the outline automatically when it is first populated
        },

        color = {
          enabled = true,
          background = true,
        },

        lsp = {
          color = { -- show the derived colours for dart variables
            enabled = false, -- whether or not to highlight color variables at all, only supported on flutter >= 2.10
            background = false, -- highlight the background
            background_color = nil, -- required, when background is transparent (i.e. background_color = { r = 19, g = 17, b = 24},)
            foreground = false, -- highlight the foreground
            virtual_text = true, -- show the highlight using virtual text
            virtual_text_str = "■", -- the virtual text character to highlight
          },
          --- OR you can specify a function to deactivate or change or control how the config is created
          capabilities = function(config)
            config.specificThingIDontWant = false
            return config
          end,
          analysisExcludedFolders = { "./fvm/" },
          -- see the link below for details on each option:
          -- https://github.com/dart-lang/sdk/blob/master/pkg/analysis_server/tool/lsp_spec/README.md#client-workspace-configuration
          settings = {
            showTodos = true,
            completeFunctionCalls = true,
            renameFilesWithClasses = "prompt", -- "always"
            -- enableSnippets = true,
            updateImportsOnRename = true, -- Whether to update imports and other directives when files are renamed. Required for `FlutterRename` command.
          },
        },

        debugger = {
          enabled = true,
          run_via_dap = true,
          exception_breakpoints = {},
          register_configurations = function(_)
            local dap = require("dap")

            dap.adapters.dart = {
              type = "executable",
              command = "dart",
              args = { "debug_adapter" },
            }

            dap.adapters.flutter = {
              type = "executable",
              command = "flutter",
              args = { "debug_adapter" },
            }

            dap.configurations.dart = {
              -- {
              --   type = "dart",
              --   request = "launch",
              --   name = "Launch dart",
              --   dartSdkPath = "/Users/demian/flutter/bin/cache/dart-sdk/bin/dart",
              --   flutterSdkPath = "/Users/demian/flutter/bin/flutter",
              --   program = "${workspaceFolder}/lib/main.dart",
              --   cwd = "${workspaceFolder}",
              -- },
              {
                type = "flutter",
                request = "launch",
                name = "Launch flutter",
                dartSdkPath = "/Users/demian/flutter/bin/cache/dart-sdk/bin/dart",
                flutterSdkPath = "/Users/demian/flutter/bin/flutter",
                program = "${workspaceFolder}/lib/main.dart",
                cwd = "${workspaceFolder}",
              },
            }

            require("dap.ext.vscode").load_launchjs()
          end,
        },
      })
    end,
  },
}
