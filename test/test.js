/**
 * Copyright 2018 Russell Aunger. All rights reserved.
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file.
 */

import * as wacs from "../../wacs-client"
import {expect} from "chai";
import fs from "fs"
import path from "path"
import tmp from "tmp"

const CONFIG = JSON.parse(fs.readFileSync("test/test.json"));
const LONGRUNTIMEMS = 15000;
const REPONAME = `wacs-client-test${Date.now()}`;
const DIR1 = tmp.dirSync({prefix:"wacs-"}).name;
const DIR2 = tmp.dirSync({prefix:"wacs-"}).name;
const FILENAME1 = "1.txt";
const FILENAME2 = "2.txt";


describe('wacs', () => {

    describe('LOGIN', () => {
        var savedUserObj;
        var savedCloneUrl;

        describe('#login()', () => {
            it('should login without error', done => {
                wacs.login(CONFIG.goodLogin, CONFIG.endpoint, CONFIG.tokenName)
                    .then(
                        result =>
                        {
                            savedUserObj = result;
                            done();
                        },
                        err => done(err)
                    );
            });

            it('should error on bad credentials', done => {
                wacs.login(CONFIG.badLogin, CONFIG.endpoint, CONFIG.tokenName)
                    .then(
                        result => done(new Error(`Shouldn't have succeeded. Response: ${result}`)),
                        err => done()
                    );
            });
        });

        describe('#create()', () => {
            before("get token", () => {
                expect(savedUserObj).to.have.property("token");
            });

            it('should return without error and give a clone URL', done => {
                wacs.create(savedUserObj, REPONAME, CONFIG.endpoint)
                    .then(
                        result => {
                            savedCloneUrl = result.clone_url;
                            expect(savedCloneUrl).to.have.string(REPONAME);
                            done();
                        },
                        err => done(err)
                    );
            });
        });

        describe('#listMyRepos()', () => {
            before("get token", () => {
                expect(savedUserObj).to.have.property("token");
            });

            it('should return without error', done => {
                wacs.listMyRepos(savedUserObj, CONFIG.endpoint)
                    .then(
                        result => done(),
                        err => done(err)
                    );
            }).timeout(LONGRUNTIMEMS);

            it('should show a newly created repo', done => {
                wacs.listMyRepos(savedUserObj, CONFIG.endpoint)
                    .then(rs => rs.map(r => r.name))
                    .then(rs => expect(rs).to.include(REPONAME))
                    .then(
                        result => done(),
                        err => done(err)
                    );
            }).timeout(LONGRUNTIMEMS);
        });

        describe('#clone()', () => {
            const gitDir = path.join(DIR1, ".git");

            before("have token", () => {
                expect(savedUserObj).to.have.property("token");
            });

            before("no preexisting .git dir", () => {
                expect(fs.existsSync(gitDir), `Exists: ${gitDir}`).to.be.false;
            });

            before("have clone URL", () => {
                expect(savedCloneUrl).to.have.string(REPONAME);
            });

            it('should produce a .git dir', done => {
                wacs.clone(savedUserObj, DIR1, savedCloneUrl)
                    .then(() => expect(fs.statSync(gitDir).isDirectory(), `isDirectory: ${gitDir}`).to.be.true)
                    .then(
                        result => done(),
                        err => done(err)
                    );
            });
        });

        describe('#commitAndPush()', () => {
            const gitDir = path.join(DIR1, ".git");

            before("have token", () => {
                expect(savedUserObj).to.have.property("token");
            });

            before("verify local dir", () => {
                expect(fs.statSync(gitDir).isDirectory(), `isDirectory: ${gitDir}`).to.be.true;
            });

            it('should initial-commit and push without error', done => {
                appendFileText(DIR1, FILENAME1, "Initial file contents\n")
                    .then(() => wacs.commitAndPush(savedUserObj, DIR1, "Initial commit, wacs-client e2e test."))
                    .then(
                        result => done(),
                        err => done(err)
                    );
            }).timeout(LONGRUNTIMEMS);
        });

        describe('update', () => {
            const gitDirOther = path.join(DIR2, ".git");

            before("have token", () => {
                expect(savedUserObj).to.have.property("token");
            });

            before("have clone URL", () => {
                expect(savedCloneUrl).to.have.string(REPONAME);
            });

            before("clone for other contributor", function(done) {
                this.timeout(LONGRUNTIMEMS);
                wacs.clone(savedUserObj, DIR2, savedCloneUrl)
                   .then(result => done(), done);
            });

            it('should commit and push an update without error', done => {
                const textToAppend = "Other contributor file update\n";
                Promise.all([FILENAME1, FILENAME2]
                    .map(f => appendFileText(DIR2, f, textToAppend)))
                    .then(() => wacs.commitAndPush(savedUserObj, DIR2, "Update, other contrib, wacs-client e2e test."))
                    .then(
                        result => done(),
                        err => done(err)
                    );
            }).timeout(LONGRUNTIMEMS);
        });


        describe('conflict', () => {
            const gitDir = path.join(DIR1, ".git");

            before("have token", () => {
                expect(savedUserObj).to.have.property("token");
            });

            before("have clone URL", () => {
                expect(savedCloneUrl).to.have.string(REPONAME);
            });

            it('should push a conflict with "mine" strategy', done => {
                const textToAppend = "Conflicting file update\n";
                appendFileText(DIR1, FILENAME1, textToAppend)
                    .then(() => wacs.commitAndPush(savedUserObj, DIR1, "Conflicting push, wacs-client e2e test."))
                    .then(
                        result => done(),
                        err => done(err)
                    );
            }).timeout(LONGRUNTIMEMS);
        });

    });

    /**
     * Append text to a file, creating the file if needed
     * @param dir containing directory
     * @param filename file path relative to dir
     * @param textToAppend what text to append to the file
     * @returns {Promise<string>} A Promise, containing the full path to the file
     */
    function appendFileText(dir, filename, textToAppend) {
        return new Promise((resolve, reject) => {
            const fullPath = path.join(dir, filename);
            fs.appendFileSync(fullPath, textToAppend);
            resolve(fullPath);
        });
    }
});

