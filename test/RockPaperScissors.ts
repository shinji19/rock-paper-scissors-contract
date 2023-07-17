import {
    time,
    loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import * as crypto from "crypto";


describe("RockPaperScissors", function () {
    const zeroAddress = "0x0000000000000000000000000000000000000000";
    const forceCloseInterval = 60;

    async function deployRockPaperScissorsFixture() {

        // Contracts are deployed using the first signer/account by default
        const accounts = await ethers.getSigners();

        const RockPaperScissors =
            await ethers.getContractFactory("RockPaperScissors");
        const rockPaperScissors =
            await RockPaperScissors.deploy(forceCloseInterval);

        return { rockPaperScissors, accounts };
    }

    describe("RockPaperScissors", function () {
        describe("Play", function () {
            async function Play(
                rockPaperScissors,
                host,
                opponent,
                hostHand,
                opponentHand,
                winnerAddress
            ){
                const deposit = 100;
                const id = crypto.randomUUID();
                const salt = "abc";

                const hostHandHash: any = ethers.keccak256(
                    new TextEncoder().encode(hostHand.toString() + salt));
                await expect(rockPaperScissors.create(id, hostHandHash, {value: deposit} as any))
                    .to.emit(rockPaperScissors, "Create")
                    .withArgs(0, 100)
                    .changeEtherBalance(host.address, -deposit);

                await expect(rockPaperScissors.connect(opponent).entry(id, opponentHand, {value: deposit} as any))
                    .to.emit(rockPaperScissors, "Entry")
                    .withArgs(id, host.address, opponent.address)
                    .changeEtherBalance(opponent.address, -deposit);

                await expect(rockPaperScissors
                    .judge(id as any, hostHand as any, salt as any))
                    .to.emit(rockPaperScissors, "Judge")
                    .withArgs(id, winnerAddress, hostHand, opponentHand);

                if (winnerAddress !== zeroAddress)
                    await expect(rockPaperScissors.close(id as any))
                        .to.emit(rockPaperScissors, "Close")
                        .withArgs(id)
                        .changeEtherBalance(winnerAddress, deposit*2);
                else
                    await expect(rockPaperScissors.close(id as any))
                        .to.emit(rockPaperScissors, "Close")
                        .withArgs(id)
                        .changeEtherBalance(host.address, deposit)
                        .changeEtherBalance(opponent.address, deposit);
            }
            it("Should play(host win)", async function(){
                const { rockPaperScissors, accounts } = await loadFixture(deployRockPaperScissorsFixture);
                await Play(
                    rockPaperScissors,
                    accounts[0],
                    accounts[1],
                    1,
                    0,
                    accounts[0].address);
            });

            it("Should play(opponent win)", async function(){
                const { rockPaperScissors, accounts } = await loadFixture(deployRockPaperScissorsFixture);
                await Play(
                    rockPaperScissors,
                    accounts[0],
                    accounts[1],
                    1,
                    2,
                    accounts[1].address);
            });

            it("Should play(draw)", async function(){
                const { rockPaperScissors, accounts } = await loadFixture(deployRockPaperScissorsFixture);
                await Play(
                    rockPaperScissors,
                    accounts[0],
                    accounts[1],
                    2,
                    2,
                    zeroAddress);
            });
        });

        describe("Entry", function () {
            it("Should revert", async function(){
                const { rockPaperScissors, accounts } = await loadFixture(deployRockPaperScissorsFixture);
                const id = crypto.randomUUID();
                const hostHandHash = ethers.keccak256(
                    new TextEncoder().encode("1" + "abc"));
                const tx = await rockPaperScissors.create(
                    id as any,
                    hostHandHash as any,
                    {value: 100} as any);
                await tx.wait();

                await expect(rockPaperScissors.connect(accounts[1]).entry(id, 0, {value: 1} as any))
                    .to.be.revertedWith("Invalid deposit.");
            });
        });

        describe("Judge", function () {
            it("Should revert", async function(){
                const { rockPaperScissors, accounts } = await loadFixture(deployRockPaperScissorsFixture);
                const id = crypto.randomUUID();
                const salt = "abc";
                {
                    const hostHandHash = ethers.keccak256(
                        new TextEncoder().encode("0" + salt));
                    const tx = await rockPaperScissors
                        .create(id as any, hostHandHash as any, {value: 100} as any);
                    await tx.wait();
                }
                {
                    const tx = await rockPaperScissors.connect(accounts[1])
                        .entry(id, 0, {value: 100} as any);
                    await tx.wait();
                }

                await expect(rockPaperScissors.judge(id as any, 1 as any, salt as any))
                    .to.be.revertedWith("Invalid hash.");
            });
        });

        describe("Force close", function () {
            const deposit = 100;
            async function Prepare(){
                const { rockPaperScissors, accounts } = await loadFixture(deployRockPaperScissorsFixture);
                const id = crypto.randomUUID();
                const salt = "abc";
                {
                    const hostHandHash = ethers.keccak256(
                        new TextEncoder().encode("0" + salt));
                    const tx = await rockPaperScissors
                        .create(id as any ,hostHandHash as any, {value: deposit} as any);
                    await tx.wait();
                }
                {
                    const tx = await rockPaperScissors.connect(accounts[1])
                        .entry(id, 1, {value: deposit} as any);
                    await tx.wait();
                }

                return { rockPaperScissors, accounts, id };
            }
            it("Should force close", async function(){
                const { rockPaperScissors, accounts, id } = await Prepare();
                await time.increase(forceCloseInterval);
                await expect(rockPaperScissors.connect(accounts[1]).forceClose(id))
                    .to.changeEtherBalance(accounts[1], deposit*2);
            });

            it("Should revert", async function(){
                const { rockPaperScissors, accounts, id } = await Prepare();
                await expect(rockPaperScissors.connect(accounts[1]).forceClose(id))
                    .to.be.revertedWith("Unreached ForceClosableTimeStamp.");
            });
        });

        describe("View", function () {
            async function View(n, page, size, expectedQuantity){
                const { rockPaperScissors, accounts } =
                    await loadFixture(deployRockPaperScissorsFixture);
                let ids = [];

                for(let i = 0; i < n; i++){
                    const id = crypto.randomUUID();
                    ids.push(id);
                    const salt = "abc";
                    const deposit = 100;
                    const hostHand = 1;
                    const opponentHand = 2;

                    const hostHandHash = ethers.keccak256(
                        new TextEncoder().encode(hostHand.toString() + salt));
                    await rockPaperScissors.create(
                        id as any, hostHandHash as any, {value: deposit} as any);

                    await rockPaperScissors.connect(accounts[1]).entry(
                        id, opponentHand, {value: deposit} as any);

                    await rockPaperScissors.judge(
                        id as any, hostHand as any, salt as any);
                }

                const competitions =
                    await rockPaperScissors.getCompetitions(page, size);
                expect(competitions.length).to.equal(expectedQuantity);
                for (let i = 0; i < expectedQuantity; i++){
                    expect(competitions[i][0]).to.equal(ids[page*size + i]);
                }
            }

            it("Get competitions page=0, size=5", async function(){
                await View(10, 0, 5, 5);
            });

            it("Get competitions page=1, size=7", async function(){
                await View(10, 1, 7, 3);
            });
        });
    });
});
