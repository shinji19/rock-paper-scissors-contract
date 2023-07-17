// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

contract RockPaperScissors {

    enum Hand {
        Rock,
        Paper,
        Scissors
    }

    enum Status {
        Open,
        Entry,
        Judge,
        Close,
        ForceClose
    }

    event Create(string id, uint deposit);
    event Entry(string id, address host, address opponent);
    event Judge(string id, address winner, Hand hostHand, Hand opponentHand);
    event Close(string id);
    event ForceClose(string id);

    // Forced termination possible time[s]
    uint public forceCloseInterval = 0;

    struct Competition {
        string Id;
        address payable Host;
        uint Deposit;
        uint ForceClosableTimeStamp;
        bytes32 HostHandHash;
        Hand HostHand;
        address payable Opponent;
        Hand OpponentHand;
        address payable Winner;
        Status Status;
    }

    mapping(string => Competition) public competitionMap;
    string[] public competitionUUIDs;

    constructor(uint _forceCloseInterval) {
        forceCloseInterval = _forceCloseInterval;
    }

    function getCompetitions(
        uint page,
        uint size
    ) public view returns (Competition[] memory) {
        uint begin = page * size;
        uint end = (page + 1) * size;
        if (end > competitionUUIDs.length) {
            end = competitionUUIDs.length;
        }
        Competition[] memory competitions = new Competition[](end - begin);
        for(uint i = 0; i < competitions.length; i++) {
            competitions[i] = competitionMap[competitionUUIDs[begin + i]];
        }
        return competitions;
    }

    /**
     * @dev Create competition.
     * Requirements:
     *
     * - `id` unique id. eg: UUID.
     * - `hostHandHash` keccak256(abi.encodePacked(hand, salt)).
     */
    function create(string memory id, bytes32 hostHandHash) public payable {
        Competition memory competition = competitionMap[id];
        require(equalsString(competition.Id, ""), "Id already exists");
        competition.Id = id;
        competition.Host = payable(msg.sender);
        competition.Deposit = msg.value;
        competition.HostHandHash = hostHandHash;
        competitionMap[id] = competition;
        competitionUUIDs.push(id);

        emit Create(id, msg.value);
    }

    modifier validateCompetition(string memory id, Status status) {
        Competition memory competition = competitionMap[id];
        require(!equalsString(competition.Id, ""), "Competition not found.");
        require(competition.Status == status, "Invalid status.");
        _;
    }

    modifier validateAuthorized(address account) {
        require(
            msg.sender == account,
            "The caller account is not authorized to perform an operation.");
        _;
    }

    /**
     * @dev Entry competition.
     * Requirements:
     *
     * - `id` unique id. eg: UUID.
     * - `opponentHand` opponent hand.
     */
    function entry(
        string memory id,
        Hand opponentHand
    ) public payable validateCompetition(id, Status.Open) {
        Competition storage competition = competitionMap[id];
        require(msg.value == competition.Deposit, "Invalid deposit.");

        competition.Opponent = payable(msg.sender);
        competition.OpponentHand = opponentHand;
        competition.ForceClosableTimeStamp = block.timestamp + forceCloseInterval;
        competition.Status = Status.Entry;

        emit Entry(id, competition.Host, msg.sender);
    }

    /**
     * @dev Judge competition. Verify host's hand hash using hand and salt.
     * Requirements:
     *
     * - `id` unique id. eg: UUID.
     * - `hostHand` host hand.
     * - `salt` salt.
     */
    function judge(
        string memory id,
        Hand hostHand,
        string memory salt
    ) public validateCompetition(id, Status.Entry) validateAuthorized(competitionMap[id].Host) {
        Competition storage competition = competitionMap[id];
        string memory hostHandString = handToString(hostHand);
        bytes32 hash = keccak256(abi.encodePacked(hostHandString, salt));
        require(hash == competition.HostHandHash, "Invalid hash.");

        address payable host = competition.Host;
        address payable opponent = competition.Opponent;
        Hand opponentHand = competition.OpponentHand;
        address payable winner;
        if (
            hostHand == Hand.Rock && opponentHand == Hand.Scissors
            || hostHand == Hand.Paper && opponentHand == Hand.Rock
            || hostHand == Hand.Scissors && opponentHand == Hand.Paper
        ){
            winner = host;
        }
        else if (hostHand != opponentHand){
            winner = opponent;
        }
        competition.HostHand = hostHand;
        competition.Winner = winner;
        competition.Status = Status.Judge;

        emit Judge(id, winner, hostHand, opponentHand);
    }

    /**
     * @dev Close competition. Transfer deposit to winner.
     * Requirements:
     *
     * - `id` unique id. eg: UUID.
     */
    function close(
        string memory id
    ) public validateCompetition(id, Status.Judge) validateAuthorized(competitionMap[id].Host) {
        Competition storage competition = competitionMap[id];
        competition.Status = Status.Close;

        uint deposit = competition.Deposit;
        if (competition.Winner != address(0)){
            competition.Winner.transfer(deposit * 2);
        }
        else{
            competition.Host.transfer(deposit);
            competition.Opponent.transfer(deposit);
        }

        emit Close(id);
    }

    /**
     * @dev Force close competition. Host does not close when opponent is winner.
     * Requirements:
     *
     * - `id` unique id. eg: UUID.
     */
    function forceClose(
        string memory id
    ) public validateCompetition(id, Status.Entry) validateAuthorized(competitionMap[id].Opponent) {
        Competition storage competition = competitionMap[id];
        require(
            competition.ForceClosableTimeStamp <= block.timestamp,
            "Unreached ForceClosableTimeStamp."
        );
        competition.Status = Status.ForceClose;

        competition.Opponent.transfer(competition.Deposit * 2);

        emit ForceClose(id);
    }

    function equalsString(
        string memory left,
        string memory right
    ) private pure returns(bool) {
        bytes memory leftBytes = bytes(left);
        bytes memory rightBytes = bytes(right);
        return
            leftBytes.length == rightBytes.length
            && keccak256(leftBytes) == keccak256(rightBytes);
    }

    string[] private handStrings = ["0", "1", "2"];

    function handToString(Hand value) private view returns(string memory)  {
        uint index = uint(value);
        // An error occurs when casting to Hand, so do not check the range of the array
        return handStrings[index];
    }
}
