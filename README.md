# `ctrlplane`: The kubernetes controller to control maximum number of jobs

In the spirit of working with new tools, we are using [turborepo](https://turborepo.org). So how was the experience? Well ... If I had time,I would move back to good old `gulp`. Anyways ...

## Getting Started

### Pre Requisites

We need the following packages to be installed

- docker `brew install docker --cask`.
- k3d `brew install k3d`.
- turbo `npm install -g turbo`.

### Quick Start

```bash
docker-compose up -d && turbo run dev
```

In order to signal the workflow, run the following command in a seperate window

```bash
node ./apps/worker/build/client.js
```

### FAQ

> Why are we moving away from accepted naming convention for javascript community for naming function and starting them with capital letter instead of small?

Because, we want to be language agnostic, and in go eco system, to indicate an exported function or constant, it is denoted by a capital letter.

### TODO

- update configuration initiation via environment variables.
- update k8s intiation to identify if we are inside the kubernetes.
- fix the watch script.
- update the documentation.
- write integration tests.
