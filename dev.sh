#!/bin/bash

SESSION=$(tmux display-message -p '#S')
CURRENT_WINDOW=$(tmux display-message -p '#I')

CMD1="pnpm start"
CMD2="pnpm --filter @budget/api dev"
CMD3="pnpm --filter @budget/mobile dev"
CMD4="pnpm --filter @budget/web dev"

PANE1=$(tmux display-message -p '#{pane_id}')
PANE2=$(tmux split-window -v -t "$PANE1" -P -F "#{pane_id}")
PANE3=$(tmux split-window -v -t "$PANE1" -P -F "#{pane_id}")
PANE4=$(tmux split-window -v -t "$PANE1" -P -F "#{pane_id}")
tmux select-layout -t "$SESSION:$CURRENT_WINDOW" even-horizontal

tmux send-keys -t "$PANE1" "$CMD1" Enter
tmux send-keys -t "$PANE2" "$CMD2" Enter
tmux send-keys -t "$PANE3" "$CMD3" Enter
tmux send-keys -t "$PANE4" "$CMD4" Enter
