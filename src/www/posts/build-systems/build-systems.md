---
tags: posts
layout: pages/post
title: Fixing the web plugin ecosystem
date: 2022-03-22T12:00:00-07:00
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

I don't want to be condescending here; these are valid complaints. Web tooling
is really complicated, Webpack configurations have become something of a meme of
unnecessary complexity in the community, and the developers complaining about
this have clearly been failed by their tools.

There are lots of reasons for the current state of affairs, but I want to dive
into one in particular related to build systems: what they are, what their
purpose is, and how we forgot to use one for web frontends.

## A TypeScript library with tests

Let's begin with a thought experiment: You have an idea to build a cool NodeJS
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
tests before running them with: `npm run build && npm test`.

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

## How did we get here?

The problem here is that we wanted an *input/output* relationship, but we
actually got a *dependency* relationship. It's not a pipeline, and it doesn't
fit that mental model. So why aren't build tools they designed this way? There
are probably a lot of historical reasons, but I personally blame page refreshes
and NPM scripts.

### A refresh away

As web developers, we've become accustomed to a culture of running a server once
and having it automatically update the page whenever we make changes. I believe
this is an artifact of old static file servers and PHP workloads which did
everything on the server at runtime and did little to nothing at build time.
Update a source file, and a clean run was only ever a refresh away!

As Node was starting to take over web tooling, new tools tried to maintain the
refresh-based developer experience with "watch mode", automatically listening
for file modification events and re-running on any change. This was reasonable
in an early tooling environment with fewer requirements.

As the ecosystem continues to grow and more of these tools need to work
together, "watch mode" becomes increasingly difficult to scale. Watching inputs
doesn't really compose across multiple tools, so usually only one tool is
perpetually active and actually watching for changes. That one tool then needs
to have knowledge of the whole build pipeline to run it when necessary. This
leads to plugin and integration style designs, introducing the *dependency*
relationship between multiple tools, largely trying to support watch mode and
keep page refreshes as the driver of the developer experience.

This strategy of plugging in multiple tools quickly breaks down as we scale up
the number of tools in the system, but no fear! We have a common means of
composing multiple tools together: NPM scripts.

### NPM scripts: just good enough

NPM scripts quickly emerged as the de facto standard for building and developing
for the web. `npm start`, `npm test`, and `npm run build` fulfill many common
development use cases. NPM scripts provides a lot of flexibility with a certain
simplicity that makes it easy to understand (it's just running terminal commands
after all).

A pattern I've seen a lot is:

```json
{
    "scripts": {
        "build": "tsc",
        "start": "npm run -s build && ./dist/server --port 8000",
        "test": "npm run -s build && jasmine"
    },
    // ...
}
```

This is an easy way to start customizing a build process. It's (kind of)
cross-platform, and you can directly run JavaScript files via Node, making
scripts infinitely extensible. This was so convenient and easy to use that NPM
scripts have become ubiquitous enough to be the baseline expectation when
starting work on a new project.

```shell
$ git clone git@github.com:user/proj.git .
$ npm install
$ npm start
```

The NPM script culture has become so pervasive that asking developers to
understand and use a dedicated command line tool is something of a faux pas.
Where other tools are used directly by devs, they are mostly framework CLIs
rather than "build tools" in the traditional sense.

The problem is that these scripts still don't scale to more than a few tools at
any time. Try adding a code generation step to the beginning of a build. Then
try writing that code generator in TypeScript, and building that. You end up
with something like:

```json
{
    "scripts": {
        "start": "npm run -s build && ./dist/server --port 8000",
        "build": "npm run -s build:codegen-tool && npm run -s build:codegen && npm run -s build:lib",
        "build:codegen": "node ./dist/codegen-tool/main.js",
        "build:codegen-tool": "(cd tools/codegen/ && tsc)",
        "build:lib": "(cd src/ && tsc)",
        "build:test-lib": "(cd src/ && tsc -p tsconfig.test.json)",
        "build:test": "npm run -s build:codegen-tool && npm run -s build:codegen && npm run -s build:test-lib",
        "test": "npm run -s build:test && jasmine"
    },
    // ...
}
```

This use case reveals a whole host of issues:

*   Lines get very long and hard to read.
*   Eventually this stops being cross-platform.
*   You can't effectively comment a JSON file.
    *   Pop quiz: what's the difference between `codegen` and `codegen-tool`? I
        had very specific definitions in mind when writing this snippet, but I
        can't communicate them because I can't comment.
*   The whole process has to be started from scratch, codegen is run on every
    build even if nothing changed!
*   I don't even want to attempt watch mode here.

NPM scripts' inability to scale with the complexity of the build process further
encourages developers to put this kind of build logic into configuration files
loaded by tools taking on too much responsibility. Why maintain all these
scripts when I can just run `jasmine` and let its configuration do all the work?
The fact that JavaScript is interpreted and very good and making JSON-like
objects also makes it a prime candidate for tools with *executable*
configuration files, which is a whole new level of complexity.

NPM scripts' position as a "good enough" tool for managing builds and yet not
actually scaling to users' needs left a generation of JS build tools trying to
fill in the gaps themselves without recognizing that it wasn't their job to
fill.

## Build systems to the rescue!

So how do we actually tackle this problem? How do we keep the page "refreshable"
and actually compose multiple unrelated tools in a single build? Well we need to
revisit the original idea of the build pipeline.

```shell
$ tsc | jasmine
```

This is how we want to think of our build. Unfortunately, it doesn't work in
Bash, but it *can* work with a build system. By "build system", I'm talking
about an orchestration tool, one which doesn't really "build" anything in
particular, but instead is responsible for managing and invoking other compilers
and tools which *are* responsible for building individual pieces of your
application.

This model allows all the individual pieces to build and run independently of
each other, letting the build system manage the inputs and outputs, file
watching, caching, etc. The build system takes on the complexity of defining how
and when each tool runs, letting the individual build tools focus on just doing
their one job. Jasmine doesn't need to know about TypeScript because the build
system already ran TypeScript, all Jasmine sees are a bunch of `*.js` files that
need to be tested.

Exactly which build system you use is up to you and there are many options out
there.

*   [GNU Make](https://www.gnu.org/software/make/) is probably the one which
    popularized the idea and is absolutely viable for web projects.
*   I'm personally a big fan of [Bazel](https://bazel.build/) and
    [`rules_nodejs`](https://github.com/bazelbuild/rules_nodejs/) is a great way
    of using it for the web.
*   [Grunt](https://gruntjs.com/) and [Gulp](https://gulpjs.com/) were some of
    the earlier Node-based tools to recognize this need, and they're still
    around.
*   [Turborepo](https://turborepo.org/) is a newer entry in this space which
    looks like its on the right track.

There are a few other tools out there which look like build systems, but really
aren't.

*   Webpack and Rollup
*   Lerna
*   Babel
