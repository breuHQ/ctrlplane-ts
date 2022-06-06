# `ctrlplane`: The kubernetes controller to control maximum number of jobs

In the spirit of working with new tools, we are using [turborepo](https://turborepo.org). So how was the experience? Well ... If I had time,I would move back to good old `gulp`. Anyways ...

## Getting Started

### Pre Requisites

We need the following packages to be installed

- docker `brew install docker --cask`.
- turbo `yarn global add turbo`.

### Quick Start

```bash
docker-compose up -d && turbo run dev
```

In order to signal the workflow, run the following command in a seperate window

```bash
node ./apps/worker/build/client.js
```

### TODO

- fix the watch script.
- update the documentation.
- write integration tests
