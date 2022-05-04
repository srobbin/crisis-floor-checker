# $CRISIS Floor Checker

Updates our Google spreadsheet with the latest floor prices once per hour

## How to works

- Hyperlink a floor price in "$CRISIS Assets" to the associated NFTInit.com page
- Once an hour, the cron job looks at the spreadsheet, fetches the floor prices
- Must have Edit access to the spreadsheet via a service account

## Development

- Install Docker
- Build the image
- Run via `docker-compose up`

## Deployment (via Heroku)

- Create a new app: `heroku create`
- Set the container for Docker: `heroku stack:set container`
- Set up [the buildpack for using Google Credentials](https://github.com/buyersight/heroku-google-application-credentials-buildpack.git)
- Update your env variables: `heroku config:set CRON_SCHEDULE="0 * * * *" ...`. Note: be sure to escape newlines in the Google credentials private key (i.e., `\\n`)
- Deploy

## TODO

- Improve README
- Investigate alternative for using Google credentials on Heroku
