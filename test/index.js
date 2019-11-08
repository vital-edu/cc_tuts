/// NB: The try-o-rama config patterns are still not quite stabilized.
/// See the try-o-rama README [https://github.com/holochain/try-o-rama]
/// for a potentially more accurate example

const path = require('path')
const tape = require('tape')

const { Orchestrator, Config, tapeExecutor, singleConductor, combine } = require('@holochain/try-o-rama')

process.on('unhandledRejection', error => {
  // Will print "unhandledRejection err is not defined"
  console.error('got unhandledRejection:', error);
});

const dnaPath = path.join(__dirname, "../dist/cc_tuts.dna.json")

const orchestrator = new Orchestrator({
  middleware: combine(
    // squash all instances from all conductors down into a single conductor,
    // for in-memory testing purposes.
    // Remove this middleware for other "real" network types which can actually
    // send messages across conductors
    singleConductor,

    // use the tape harness to run the tests, injects the tape API into each scenario
    // as the second argument
    tapeExecutor(tape),

  ),
  globalConfig: {
    logger: false,
    network: 'memory',
  },

  // the following are optional:

  waiter: {
    softTimeout: 5000,
    hardTimeout: 10000,
  },
})

const conductorConfig = {
  instances: {
    cc_tuts: Config.dna(dnaPath, 'cc_tuts'),
  },
}

orchestrator.registerScenario('Test hello holo', async (s, t) => {
  const { alice, bob } = await s.players({ alice: conductorConfig, bob: conductorConfig }, true)
  // Make a call to the `hello_holo` Zome function
  // passing no arguments.
  const result = await alice.call('cc_tuts', 'hello', 'hello_holo', {})
  // Make sure the result is ok.
  t.ok(result.Ok)

  // Check that the result matches what you expected.
  t.deepEqual(result, { Ok: 'Hello Holo' })
  await s.consistency()
  const create_result = await alice.call('cc_tuts', 'hello', 'create_person', {
    'person': { 'name': 'Alice' }
  })

  t.ok(create_result.Ok)
  const alice_person_address = create_result.Ok

  await s.consistency()

  const retrieve_result = await alice.call('cc_tuts', 'hello', 'retrieve_person', {
    'address': alice_person_address
  })

  t.ok(retrieve_result.Ok)
  t.deepEqual(retrieve_result, { Ok: { 'name': 'Alice' } })

  await s.consistency();
  const bob_retrieve_result = await bob.call('cc_tuts', 'hello', 'retrieve_person', {
    'address': alice_person_address
  });
  t.ok(bob_retrieve_result.Ok);
  const bobs_person = bob_retrieve_result.Ok;
  t.deepEqual(bobs_person, { 'name': 'Alice' });
})


orchestrator.run()
