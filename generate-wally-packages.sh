#!/bin/sh

# Check, because I like to run this locally
if [ ! -d wally-index ]; then
	mkdir wally-index
	cd wally-index
	git init
	git remote add origin https://github.com/upliftgames/wally-index
	git fetch --depth 1 origin main
	git checkout FETCH_HEAD
else
	cd wally-index
fi

FIRST_RUN=1

echo "{"

for WALLY_PACKAGE in $(find */* -type f ! -name '*.*')
do
	if [ "$FIRST_RUN" -eq 1 ]; then
		FIRST_RUN=0
	else
		echo ","
	fi

	MOST_RECENT_PUSH=$(head $WALLY_PACKAGE -n 1)
	MOST_RECENT_VERSION=$(echo "$MOST_RECENT_PUSH" | jq .package.version)

	echo -n "\"$WALLY_PACKAGE\": {\"version\": $MOST_RECENT_VERSION}"
done

echo "\n}"
