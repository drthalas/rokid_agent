#!/bin/sh
set -eu
mkdir -p references
fetch() {
  name=$1 repo=$2 commit=$3
  if [ ! -d "references/$name/.git" ]; then git clone "$repo" "references/$name"; fi
  git -C "references/$name" fetch origin "$commit"
  git -C "references/$name" checkout --detach "$commit"
}
fetch Rokid-Nexus https://github.com/Anezium/Rokid-Nexus.git 49128717b635783a5859dda307284f2d1eafd3eb
fetch rokidhub-codex https://github.com/lavAzza2/rokidhub-codex.git 892fcc7a81b2abae4cd5bcea41b6a2746928225a
fetch rokid-personal-ai https://github.com/ksuzukigh/rokid-personal-ai.git 23f98ff2946f7575997383929b87867503eab607
