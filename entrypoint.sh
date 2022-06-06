#!/bin/sh
set -e

echo "selenology"

echo "cloning current branch"
git clone $CURRENT_SELENE_REPOSITORY selene-current
cd selene-current

install() {
	mkdir -p /usr/bin/$1
	cargo install --path selene --root /usr/bin/$1
	mv /usr/bin/$1/bin/selene /usr/bin/selene/$1
}

echo "building current branch"
git checkout $CURRENT_SELENE_CHECKOUT
install selene-current

echo "cloning new branch"
cd ..
git clone $NEW_SELENE_REPOSITORY selene-new

echo "building new branch"
cd selene-new
git checkout $NEW_SELENE_CHECKOUT
install selene-new

OUTPUT=$(SELENE_NEW=/usr/bin/selene/selene-new \
	SELENE_OLD=/usr/bin/selene/selene-current \
	CLONE_DIRECTORY=/usr/local/repos \
	node /usr/src/selenology/selenology.js)
OUTPUT="${OUTPUT//'%'/'%25'}"
OUTPUT="${OUTPUT//$'\n'/'%0A'}"
OUTPUT="${OUTPUT//$'\r'/'%0D'}"
echo "::set-output name=output::$(echo "$OUTPUT")"
