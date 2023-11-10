// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Schnorr} from "./Schnorr.sol";

/*interface IVerifier {
    function verify(uint8 parity, bytes32 px, bytes32 message, bytes32 e, bytes32 s) external view returns (bool);
    function id() external view returns (uint);
}*/

contract MyToken is ERC20, Ownable, Schnorr {
    enum SignatureType{SCHNORR, ECDSA}
    event Transfer(address indexed to, bytes32 hash, uint amount);

    constructor(string memory name, string memory symbol) ERC20(name, symbol) Ownable(msg.sender) {
        _mint(msg.sender, 100 * 10 ** uint(decimals()));
    }

    function mint(address account, uint256 amount) external onlyOwner {
        _mint(account, amount);
    }

    function transferOnBehalf(SignatureType _signatureType, address _from, address to, uint256 value, uint8 _v,
        bytes32 _r, bytes32 _s, bytes32 _e) public returns (bool) {
        _validateTransferSignature(_signatureType, _from, to, value, _v, _r, _s, _e);
        emit Transfer(_from, to, value);
        _transfer(_from, to, value);
        return true;
    }


    /**
* @notice Internal method which recovers address from signature of the parameters and throws if not _stealthAddr
   * @param _signatureType type of signature
   * @param _from The address whose token balance will be withdrawn
   * @param _to Address where withdrawn funds should be sent
   * @param _v ECDSA signature component: Parity of the `y` coordinate of point `R`
   * @param _r ECDSA signature component: x-coordinate of `R`
   * @param _s ECDSA signature component: `s` value of the signature
   * @param _e Schnorr signature component: `e` value of the signature
   */
    function _validateTransferSignature(
        SignatureType _signatureType,
        address _from,
        address _to,
        uint amount,
        uint8 _v,
        bytes32 _r,
        bytes32 _s,
        bytes32 _e
    ) public view returns (bytes32){
        uint256 _chainId;
        assembly {
            _chainId := chainid()
        }

        bytes32 _digest = keccak256(abi.encodePacked(_chainId, address(this), _from, _to, amount));
        if (_signatureType == SignatureType.ECDSA) {
            address _recoveredAddress = ecrecover(_digest, _v, _r, _s);
            require(_recoveredAddress != address(0) && _recoveredAddress == _from, "ECDSA Invalid Signature");
        }
        else {
            require(verify(_v, _r, _digest, _e, _s), "Schnorr Invalid Signature");
        }
    }


}

