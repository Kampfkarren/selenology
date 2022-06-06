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
	REPO=https://github.com/$WALLY_PACKAGE

	# Check if the repository exists
	if curl -s -o /dev/null -I $REPO --fail; then
		>&2 echo -n "\n404: $REPO"
	else
		if [ "$FIRST_RUN" -eq 1 ]; then
			FIRST_RUN=0
		else
			echo ","
		fi

		echo -n "\"$WALLY_PACKAGE\": { \"repo\": \"$REPO\", \"roblox\": true, \"args\": [\".\"], \"branch\": \"\" }"
	fi
done

echo "}"
