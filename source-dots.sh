#!/bin/zsh

# Dotfiles symbolic link management script
# Usage: ./source-dots.sh

DOTFILES_DIR="$HOME/dotfiles"
CONFIG_DIR="$HOME/.config"

# Color definitions
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Check if fzf is available
FZF_AVAILABLE=false
if command -v fzf >/dev/null 2>&1; then
  FZF_AVAILABLE=true
fi

# Group definitions
# Format: "group_name|description|item1,item2,item3"
declare -A CONFIG_GROUPS=(
  ["zsh"]="Zsh configuration (.zshrc, .zshenv, .zprofile)|zshrc,zshenv,zprofile"
  ["git"]="Git configuration (.gitconfig, .gitconfig.local)|gitconfig,gitconfig-local"
)

# Configuration items definition
# Format: "item_name|source_path|target_path|description"
declare -A CONFIG_ITEMS=(
  # Files linked directly to home directory
  ["zshrc"]="$DOTFILES_DIR/.config/zsh/.zshrc|$HOME/.zshrc|Zsh RC file"
  ["zshenv"]="$DOTFILES_DIR/.config/zsh/.zshenv|$HOME/.zshenv|Zsh environment variables"
  ["zprofile"]="$DOTFILES_DIR/.config/zsh/.zprofile|$HOME/.zprofile|Zsh profile"
  ["gitconfig"]="$DOTFILES_DIR/.config/git/.gitconfig|$HOME/.gitconfig|Git configuration"
  ["gitconfig-local"]="$DOTFILES_DIR/.config/git/.gitconfig.local|$HOME/.gitconfig.local|Git local configuration"
  
  # Files linked to ~/.config/ path
  ["starship"]="$DOTFILES_DIR/.config/starship/starship.toml|$CONFIG_DIR/starship.toml|Starship prompt"
  
  # Folders linked to ~/.config/ path
  ["nvim"]="$DOTFILES_DIR/.config/nvim|$CONFIG_DIR/nvim|Neovim configuration"
  ["opencode"]="$DOTFILES_DIR/.config/opencode|$CONFIG_DIR/opencode|OpenCode AI assistant"
  ["wezterm"]="$DOTFILES_DIR/.config/wezterm|$CONFIG_DIR/wezterm|Wezterm terminal"
  ["yazi"]="$DOTFILES_DIR/.config/yazi|$CONFIG_DIR/yazi|Yazi file manager"
  ["lazygit"]="$DOTFILES_DIR/.config/lazygit|$CONFIG_DIR/lazygit|Lazygit configuration"
  ["ripgrep"]="$DOTFILES_DIR/.config/ripgrep|$CONFIG_DIR/ripgrep|Ripgrep configuration"
)

# Link status check function
check_link_status() {
  local target=$1
  local expected_source=$2
  
  if [ -L "$target" ]; then
    # Follow symbolic link chain to find actual file path
    # Call readlink multiple times to follow symbolic link chain
    local actual_path="$target"
    local max_depth=10
    local depth=0
    
    while [ -L "$actual_path" ] && [ $depth -lt $max_depth ]; do
      local link_target=$(readlink "$actual_path")
      if [[ "$link_target" != /* ]]; then
        # Convert relative path to absolute path
        local target_dir=$(dirname "$actual_path")
        actual_path="$target_dir/$link_target"
      else
        actual_path="$link_target"
      fi
      ((depth++))
    done
    
    # Normalize paths (using zsh's :P modifier - convert to absolute path and resolve symbolic links)
    local actual_normalized=${actual_path:P}
    local expected_normalized=${expected_source:P}
    
    if [ "$actual_normalized" = "$expected_normalized" ]; then
      echo "linked"
    else
      echo "wrong_link"
    fi
  elif [ -e "$target" ]; then
    echo "exists"
  else
    echo "missing"
  fi
}

# Link creation function
create_link() {
  local source=$1
  local target=$2
  local name=$3
  
  # Check if source file/directory exists
  if [ ! -e "$source" ]; then
    echo -e "${RED}✗${NC} $name: Source path does not exist ($source)"
    return 1
  fi
  
  # Check if target already exists
  local link_status=$(check_link_status "$target" "$source")
  
  case $link_status in
    "linked")
      echo -e "${GREEN}✓${NC} $name: Already has correct link"
      return 0
      ;;
    "wrong_link")
      echo -e "${YELLOW}⚠${NC} $name: Different link exists. Delete it? (y/N)"
      read -r response
      if [[ "$response" =~ ^[Yy]$ ]]; then
        rm "$target"
      else
        return 1
      fi
      ;;
    "exists")
      echo -e "${YELLOW}⚠${NC} $name: Existing file/directory found. Backup it? (y/N)"
      read -r response
      if [[ "$response" =~ ^[Yy]$ ]]; then
        mv "$target" "${target}.backup.$(date +%Y%m%d_%H%M%S)"
        echo -e "${BLUE}ℹ${NC} Backup completed: ${target}.backup.$(date +%Y%m%d_%H%M%S)"
      else
        echo -e "${RED}✗${NC} $name: Skipping link creation"
        return 1
      fi
      ;;
  esac
  
  # Create target directory if needed
  local target_dir=$(dirname "$target")
  if [ ! -d "$target_dir" ]; then
    mkdir -p "$target_dir"
  fi
  
  # Create symbolic link
  if ln -sf "$source" "$target"; then
    echo -e "${GREEN}✓${NC} $name: Link created successfully"
    return 0
  else
    echo -e "${RED}✗${NC} $name: Link creation failed"
    return 1
  fi
}

# Status display function
show_status() {
  echo -e "\n${BLUE}=== Current Link Status ===${NC}\n"
  
  # Display groups
  echo -e "${CYAN}--- Groups ---${NC}"
  for group_name in "${(@k)CONFIG_GROUPS}"; do
    IFS='|' read -r desc items <<< "${CONFIG_GROUPS[$group_name]}"
    echo -e "\n${CYAN}[Group] $group_name: $desc${NC}"
    IFS=',' read -rA item_array <<< "$items"
    for item in "${item_array[@]}"; do
      if [ -n "${CONFIG_ITEMS[$item]}" ]; then
        IFS='|' read -r source target item_desc <<< "${CONFIG_ITEMS[$item]}"
        local link_status=$(check_link_status "$target" "$source")
        case $link_status in
          "linked")
            echo -e "  ${GREEN}✓${NC} $item: $item_desc"
            ;;
          "wrong_link")
            echo -e "  ${RED}✗${NC} $item: $item_desc (wrong link)"
            ;;
          "exists")
            echo -e "  ${YELLOW}⚠${NC} $item: $item_desc (existing file)"
            ;;
          "missing")
            echo -e "  ${BLUE}○${NC} $item: $item_desc (no link)"
            ;;
        esac
      fi
    done
  done
  
  # Display individual items (not in groups)
  echo -e "\n${CYAN}--- Individual Items ---${NC}"
  for item_name in "${(@k)CONFIG_ITEMS}"; do
    # Check if item is in a group
    local in_group=false
    for group_name in "${(@k)CONFIG_GROUPS}"; do
      IFS='|' read -r desc items <<< "${CONFIG_GROUPS[$group_name]}"
      if [[ ",$items," =~ ",$item_name," ]]; then
        in_group=true
        break
      fi
    done
    
    # Skip lazygit from menu display
    if [ "$item_name" = "lazygit" ]; then
      continue
    fi
    
    if [ "$in_group" = false ]; then
      IFS='|' read -r source target item_desc <<< "${CONFIG_ITEMS[$item_name]}"
      local link_status=$(check_link_status "$target" "$source")
      case $link_status in
        "linked")
          echo -e "${GREEN}✓${NC} $item_name: $item_desc"
          ;;
        "wrong_link")
          echo -e "${RED}✗${NC} $item_name: $item_desc (wrong link)"
          ;;
        "exists")
          echo -e "${YELLOW}⚠${NC} $item_name: $item_desc (existing file)"
          ;;
        "missing")
          echo -e "${BLUE}○${NC} $item_name: $item_desc (no link)"
          ;;
      esac
    fi
  done
  echo ""
}

# Main menu with fzf
show_menu() {
  if [ "$FZF_AVAILABLE" = true ]; then
    local menu_options=(
      "Check status"
      "Create links (selective)"
      "Create all links"
      "Exit"
    )
    
    local selected=$(printf '%s\n' "${menu_options[@]}" | \
      fzf --height=10 \
          --bind 'j:down,k:up' \
          --bind 'ctrl-n:down,ctrl-p:up' \
          --bind 'ctrl-c:abort' \
          --bind 'esc:cancel' \
          --header="Dotfiles Link Management (↑↓/j/k: navigate, Enter: select)")
    
    if [ -z "$selected" ]; then
      echo "Exiting."
      exit 0
    fi
    
    case "$selected" in
      "Check status")
        echo "1"
        ;;
      "Create links (selective)")
        echo "2"
        ;;
      "Create all links")
        echo "3"
        ;;
      "Exit")
        echo "4"
        ;;
    esac
  else
    # Fallback to traditional menu if fzf is not available
    echo -e "\n${BLUE}=== Dotfiles Link Management ===${NC}\n"
    echo "1) Check status"
    echo "2) Create links (selective)"
    echo "3) Create all links"
    echo "4) Exit"
    echo ""
    echo -n "Select [1-4]: "
    read -r choice
    echo "$choice"
  fi
}

# Selective link creation with fzf
create_selected_links() {
  echo -e "\n${BLUE}=== Create Links ===${NC}\n"
  
  local menu_items=()
  local menu_item_types=()  # Parallel array to store item types
  
    # Build menu items for groups (only include groups that are not fully linked and have existing source files)
    for group_name in "${(@k)CONFIG_GROUPS}"; do
      IFS='|' read -r desc items <<< "${CONFIG_GROUPS[$group_name]}"
      
      # Check status of all items in group
      IFS=',' read -rA item_array <<< "$items"
      local all_linked=true
      local has_existing_source=false
      for item in "${item_array[@]}"; do
        if [ -n "${CONFIG_ITEMS[$item]}" ]; then
          IFS='|' read -r source target item_desc <<< "${CONFIG_ITEMS[$item]}"
          # Check if source file/directory exists
          if [ -e "$source" ]; then
            has_existing_source=true
            local link_status=$(check_link_status "$target" "$source")
            if [ "$link_status" != "linked" ]; then
              all_linked=false
            fi
          fi
        fi
      done
      
      # Skip groups that are already fully linked or have no existing source files
      if [ "$all_linked" = true ] || [ "$has_existing_source" = false ]; then
        continue
      fi
      
      local menu_line="[Group] $group_name - $desc"
      menu_items+=("$menu_line")
      menu_item_types+=("group:$group_name")
    done
  
  # Build menu items for individual items (not in groups, excluding lazygit and already linked items)
  for item_name in "${(@ok)CONFIG_ITEMS}"; do
    # Check if item is in a group
    local in_group=false
    for group_name in "${(@k)CONFIG_GROUPS}"; do
      IFS='|' read -r desc items <<< "${CONFIG_GROUPS[$group_name]}"
      if [[ ",$items," =~ ",$item_name," ]]; then
        in_group=true
        break
      fi
    done
    
    # Skip lazygit
    if [ "$item_name" = "lazygit" ]; then
      continue
    fi
    
    if [ "$in_group" = false ]; then
      IFS='|' read -r source target item_desc <<< "${CONFIG_ITEMS[$item_name]}"
      
      # Skip items where source file/directory doesn't exist
      if [ ! -e "$source" ]; then
        continue
      fi
      
      local link_status=$(check_link_status "$target" "$source")
      
      # Skip already linked items
      if [ "$link_status" = "linked" ]; then
        continue
      fi
      
      local menu_line="$item_name - $item_desc"
      menu_items+=("$menu_line")
      menu_item_types+=("item:$item_name")
    fi
  done
  
  # Check if there are any items to link
  if [ ${#menu_items[@]} -eq 0 ]; then
    echo -e "${GREEN}✓${NC} All items are already linked!"
    return
  fi
  
  if [ "$FZF_AVAILABLE" = true ]; then
    # Use fzf for selection - fzf returns the exact menu line text
    local selected_items=$(printf '%s\n' "${menu_items[@]}" | \
      fzf --multi \
          --height=15 \
          --bind 'j:down,k:up' \
          --bind 'ctrl-n:down,ctrl-p:up' \
          --bind 'space:toggle' \
          --bind 'tab:toggle' \
          --bind 'ctrl-a:select-all' \
          --bind 'ctrl-d:deselect-all' \
          --bind 'ctrl-c:abort' \
          --bind 'esc:cancel' \
          --header="Select items to link (↑↓/j/k: navigate, Space/Tab: toggle, Enter: confirm, Ctrl-A: all, Ctrl-D: none)")
    
    if [ -z "$selected_items" ]; then
      echo "No items selected."
      return
    fi
    
    # Track results
    local success_count=0
    local skip_count=0
    local fail_count=0
    
    # Process selected items by finding their index in menu_items array
    while IFS= read -r selected_item; do
      # Trim whitespace, newlines, and control characters
      selected_item=$(printf '%s' "$selected_item" | tr -d '\r\n' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
      [ -z "$selected_item" ] && continue
      
      # Find the index of the selected item in menu_items array
      local found_index=-1
      local i=1
      for menu_item in "${menu_items[@]}"; do
        local normalized_menu=$(printf '%s' "$menu_item" | tr -d '\r\n' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
        local normalized_selected=$(printf '%s' "$selected_item" | tr -d '\r\n' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
        
        if [ "$normalized_menu" = "$normalized_selected" ]; then
          found_index=$i
          break
        fi
        ((i++))
      done
      
      if [ $found_index -eq -1 ]; then
        echo -e "${RED}✗${NC} Error: Could not find mapping for '$selected_item'"
        continue
      fi
      
      # Get item type from parallel array (zsh arrays are 1-indexed for our purpose)
      local item_type="${menu_item_types[$found_index]}"
      
      if [ -z "$item_type" ]; then
        echo -e "${RED}✗${NC} Error: Could not find item type for index $found_index"
        continue
      fi
      
      if [[ "$item_type" =~ ^group: ]]; then
        # Process group
        local group_name="${item_type#group:}"
        IFS='|' read -r desc items <<< "${CONFIG_GROUPS[$group_name]}"
        echo -e "\n${CYAN}Processing group '$group_name'...${NC}"
        IFS=',' read -rA item_array <<< "$items"
        for item in "${item_array[@]}"; do
          if [ -n "${CONFIG_ITEMS[$item]}" ]; then
            IFS='|' read -r source target item_desc <<< "${CONFIG_ITEMS[$item]}"
            if create_link "$source" "$target" "$item"; then
              ((success_count++))
            else
              local link_status=$(check_link_status "$target" "$source")
              if [ "$link_status" = "linked" ]; then
                ((skip_count++))
              else
                ((fail_count++))
              fi
            fi
          fi
        done
      elif [[ "$item_type" =~ ^item: ]]; then
        # Process individual item
        local item_name="${item_type#item:}"
        IFS='|' read -r source target item_desc <<< "${CONFIG_ITEMS[$item_name]}"
        if create_link "$source" "$target" "$item_name"; then
          ((success_count++))
        else
          local link_status=$(check_link_status "$target" "$source")
          if [ "$link_status" = "linked" ]; then
            ((skip_count++))
          else
            ((fail_count++))
          fi
        fi
      fi
    done <<< "$selected_items"
    
    # Show summary
    echo -e "\n${BLUE}=== Summary ===${NC}"
    echo -e "${GREEN}✓${NC} Successfully linked: $success_count"
    if [ $skip_count -gt 0 ]; then
      echo -e "${YELLOW}○${NC} Skipped (already linked): $skip_count"
    fi
    if [ $fail_count -gt 0 ]; then
      echo -e "${RED}✗${NC} Failed: $fail_count"
    fi
    echo ""
  else
    # Fallback to traditional menu
    local index=1
    declare -A menu_items_index=()
    
    echo -e "${CYAN}--- Groups ---${NC}"
    for group_name in "${(@k)CONFIG_GROUPS}"; do
      IFS='|' read -r desc items <<< "${CONFIG_GROUPS[$group_name]}"
      menu_items_index[$index]="group:$group_name"
      
      IFS=',' read -rA item_array <<< "$items"
      local all_linked=true
      for item in "${item_array[@]}"; do
        if [ -n "${CONFIG_ITEMS[$item]}" ]; then
          IFS='|' read -r source target item_desc <<< "${CONFIG_ITEMS[$item]}"
          local link_status=$(check_link_status "$target" "$source")
          if [ "$link_status" != "linked" ]; then
            all_linked=false
            break
          fi
        fi
      done
      
      if [ "$all_linked" = true ]; then
        echo -e "[${GREEN}✓${NC}] $index) [Group] $group_name - $desc"
      else
        echo -e "[ ] $index) [Group] $group_name - $desc"
      fi
      ((index++))
    done
    
    echo -e "\n${CYAN}--- Individual Items ---${NC}"
    for item_name in "${(@ok)CONFIG_ITEMS}"; do
      local in_group=false
      for group_name in "${(@k)CONFIG_GROUPS}"; do
        IFS='|' read -r desc items <<< "${CONFIG_GROUPS[$group_name]}"
        if [[ ",$items," =~ ",$item_name," ]]; then
          in_group=true
          break
        fi
      done
      
      if [ "$item_name" = "lazygit" ]; then
        continue
      fi
      
      if [ "$in_group" = false ]; then
        menu_items_index[$index]="item:$item_name"
        IFS='|' read -r source target item_desc <<< "${CONFIG_ITEMS[$item_name]}"
        local link_status=$(check_link_status "$target" "$source")
        
        if [ "$link_status" = "linked" ]; then
          echo -e "[${GREEN}✓${NC}] $index) $item_name - $item_desc"
        else
          echo -e "[ ] $index) $item_name - $item_desc"
        fi
        ((index++))
      fi
    done
    
    echo ""
    echo -n "Enter item numbers to create (comma-separated, e.g., 1,3,5 or 'all'): "
    read -r input
    
    if [ "$input" = "all" ]; then
      # Process all groups
      for group_name in "${(@k)CONFIG_GROUPS}"; do
        IFS='|' read -r desc items <<< "${CONFIG_GROUPS[$group_name]}"
        IFS=',' read -rA item_array <<< "$items"
        for item in "${item_array[@]}"; do
          if [ -n "${CONFIG_ITEMS[$item]}" ]; then
            IFS='|' read -r source target item_desc <<< "${CONFIG_ITEMS[$item]}"
            create_link "$source" "$target" "$item"
          fi
        done
      done
      # Process all individual items (excluding lazygit)
      for item_name in "${(@k)CONFIG_ITEMS}"; do
        if [ "$item_name" = "lazygit" ]; then
          continue
        fi
        
        local in_group=false
        for group_name in "${(@k)CONFIG_GROUPS}"; do
          IFS='|' read -r desc items <<< "${CONFIG_GROUPS[$group_name]}"
          if [[ ",$items," =~ ",$item_name," ]]; then
            in_group=true
            break
          fi
        done
        if [ "$in_group" = false ]; then
          IFS='|' read -r source target item_desc <<< "${CONFIG_ITEMS[$item_name]}"
          create_link "$source" "$target" "$item_name"
        fi
      done
    else
      IFS=',' read -rA selections <<< "$input"
      for sel in "${selections[@]}"; do
        sel=$(echo "$sel" | tr -d ' ')
        if [[ "$sel" =~ ^[0-9]+$ ]] && [ -n "${menu_items_index[$sel]}" ]; then
          local menu_item="${menu_items_index[$sel]}"
          if [[ "$menu_item" =~ ^group: ]]; then
            local group_name="${menu_item#group:}"
            IFS='|' read -r desc items <<< "${CONFIG_GROUPS[$group_name]}"
            echo -e "\n${CYAN}Processing group '$group_name'...${NC}"
            IFS=',' read -rA item_array <<< "$items"
            for item in "${item_array[@]}"; do
              if [ -n "${CONFIG_ITEMS[$item]}" ]; then
                IFS='|' read -r source target item_desc <<< "${CONFIG_ITEMS[$item]}"
                create_link "$source" "$target" "$item"
              fi
            done
          elif [[ "$menu_item" =~ ^item: ]]; then
            local item_name="${menu_item#item:}"
            IFS='|' read -r source target item_desc <<< "${CONFIG_ITEMS[$item_name]}"
            create_link "$source" "$target" "$item_name"
          fi
        else
          echo -e "${RED}✗${NC} Invalid number: $sel"
        fi
      done
    fi
  fi
}

# Create all links function
create_all_links() {
  echo -e "\n${BLUE}Creating all links...${NC}\n"
  
  # Process all groups
  for group_name in "${(@k)CONFIG_GROUPS}"; do
    IFS='|' read -r desc items <<< "${CONFIG_GROUPS[$group_name]}"
    IFS=',' read -rA item_array <<< "$items"
    for item in "${item_array[@]}"; do
      if [ -n "${CONFIG_ITEMS[$item]}" ]; then
        IFS='|' read -r source target item_desc <<< "${CONFIG_ITEMS[$item]}"
        create_link "$source" "$target" "$item"
      fi
    done
  done
  
  # Process all individual items (excluding lazygit)
  for item_name in "${(@k)CONFIG_ITEMS}"; do
    # Skip lazygit
    if [ "$item_name" = "lazygit" ]; then
      continue
    fi
    
    local in_group=false
    for group_name in "${(@k)CONFIG_GROUPS}"; do
      IFS='|' read -r desc items <<< "${CONFIG_GROUPS[$group_name]}"
      if [[ ",$items," =~ ",$item_name," ]]; then
        in_group=true
        break
      fi
    done
    if [ "$in_group" = false ]; then
      IFS='|' read -r source target item_desc <<< "${CONFIG_ITEMS[$item_name]}"
      create_link "$source" "$target" "$item_name"
    fi
  done
}

# Main loop
main() {
  while true; do
    local choice=$(show_menu)
    
    case $choice in
      1)
        show_status
        ;;
      2)
        create_selected_links
        ;;
      3)
        create_all_links
        ;;
      4)
        echo "Exiting."
        exit 0
        ;;
      *)
        if [ "$FZF_AVAILABLE" = false ]; then
          echo -e "${RED}Invalid selection.${NC}"
        fi
        ;;
    esac
  done
}

# Execute script
main
