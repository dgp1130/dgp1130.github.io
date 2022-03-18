---
tags: posts
layout: pages/post
title: Fixing the web plugin ecosystem
date: 2022-03-17T12:00:00-07:00
excerpt: |
  Why does every frontend tool have a plugin ecosystem? Maybe we forgot what a
  real build system is.
---

# Fixing the web plugin ecosystem

```timestamp
```

TODO: Title, description, date.
TODO: `shell` / `json` languages.

Talk with a frontend web developer for five minutes and they'll quickly tell you
all about how the tooling ecosystem sucks. "It's so complicated." "There's too
many plugins." "No one understands our build." "TypeScript needs to integrate
with *everything*."

I don't want to come off as condescending, these are valid complaints. Web
tooling is really complicated, Webpack configurations have become something of a
meme of unnecessary complexity in the community, and the developers complaining
about this have clearly been failed by their tools.

There are lots of reasons for the current state of affairs, but I want to dive
into one in particular about build systems: what they are, what their purpose
is, and how we forgot to use one for web frontends.

## A TypeScript library with tests

Let's begin with a thought experiment, you have an idea to build a cool NodeJS
library. Awesome! Where do you start? If you're like me, the first thing you do
is create an empty package and immediately add TypeScript.

```shell
$ npm init -y
$ npx -p typescript tsc --init
$ npm install typescript --save-dev
```

Then you add a build script:

```json
{
    "scripts": {
        "build": "tsc"
    },
    // ...
}
```

Now you can `npm run build` and your TypeScript is set up just fine. It's
simple, but it works. Then you get to the next challenge, adding tests. So now
you add Jasmine (or Karma or Jest, they're all the same here):

```shell
$ npx jasmine init
$ npm install jasmine @types/jasmine --save-dev
```

You update your `npm test` command to run `jasmine`, add a simple test
(`fooSpec.ts`) and run it, only to find:

```shell
$ npm test

> my-lib@1.0.0 test
> jasmine

Randomized with seed 05933
Started


No specs found
Finished in 0.002 seconds
Incomplete: No specs found
Randomized with seed 05933 (jasmine --random=true --seed=05933)
```

No specs found? Oh, right! Jasmine only runs JS, not TS. So I need to build my
test file: `npm run build && npm test`.

You might be happy with this for a little while, but you'll quickly discover
three problems with this approach:

1.  You must remember to execute `npm run build`. If you forget this, your tests
    will still run with no indication that you skipped a step. Eventually you
    update `npm test` to automatically build first.
1.  If you add a broken test, then delete its source file, you'll find that the
    test is still failing! This is because even though you deleted the `*.ts`
    source file, the built `*.js` is still lying around and being executed by
    Jasmine. Eventually you add `npm run clean` and automatically run that
    before builds.
1.  You can't live reload changes! This is technically because `jasmine` doesn't
    actually support a watch mode. Even if it did watch, it would only watch its
    input `*.js` files. And even if it did watch the actual `*.ts` source files,
    Jasmine doesn't understand how to compile them!

TODO: Swap Jasmine with Karma?

The live reload issue is usually the first one developers really notice, but
issues 1. and 2. are simpler demonstrations of the same problem, namely that
one tool (Jasmine) depends the output of another tool (TypeScript).

If you Google this you'll find solutions telling you to use `ts-node` or
`jasmine-ts`, but these highlight the main problem. In order for Jasmine and
TypeScript to work together, they seem to need direct knowledge and integration
with each other. This leads to plugins, integrations, and community packages
which exist solely to combine two other tools (`jasmine-ts`). It means that any
given combination of tools you want to use in an application (TypeScript *
Jasmine * Webpack * Karma * Babel) has an exponential growth of plugins,
integrations, and options needed to work together coherently.

## A build pipeline

Are these integrations really necessary though? This example is fairly
straightforward, all I want is for a TypeScript build to feed into Jasmine. Is
that really so hard?

What I actually want is a *pipeline*. Ideally, I want to run:

```shell
$ tsc | jasmine
```

and have that just work. Of course, Bash pipes don't really work that way, but
it's indicative of the mental model we should have. TypeScript outputs some
`*.js` files which then get consumed and executed by Jasmine. Yet this
input/output relationship is not reflected in actual web build tools. Since
Jasmine is the tool that's running, it needs to watch and compile its inputs, so
it naturally needs to *depend on* the tooling which compiles those inputs. That
makes some sense, but of course the Jasmine team doesn't want to have a hard
dependency on TypeScript, not everyone uses that. So instead we need a plugin or
combination package to make Jasmine depend on TypeScript correctly.

The problem here is that we wanted an *input/output* relationship, but we
actually got a *dependency* relationship. It's not a pipeline, and it doesn't
fit that mental model. So why aren't build tools they designed this way? There
are probably a lot of reasons, but I'm going to take a bold stance and say that
it's live reload's fault.

### The tyranny of live reload

As web developers, we've developed a culture of running a server once and having
it automatically update the page whenever we make changes. I believe this is an
artifact of old static file servers and PHP workloads which did everything on
the server at runtime and did little to nothing at build time. A fresh run was
only ever a refresh away!

Modern build tools change this dynamic and we can no longer just refresh the
page, but must also rebuild the code. This isn't hard on its own, but we've kept
the same expectation that a refresh should be all that's necessary. That we
shouldn't *have* to rebuild the frontend. Of course, we still do *need* to
rebuild, that's the nature of writing in a compiled language. So the best we can
do is to avoid *telling* the application to rebuild. This means our build
tooling must be configured to listen for a file save event, and propagate it all
the way to the browser.
