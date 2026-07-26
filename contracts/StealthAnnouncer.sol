// SPDX-License-Identifier: GPL-3.0

pragma solidity >=0.7.0 <0.9.0;

/// @title StealthAnnouncer — Event-only contract for stealth address announcements
/// @notice Restaurants scan these events to discover orders addressed to their stealth keys.
///         Customer derives a one-time stealth address via ECDH and announces the ephemeral
///         public key here. The restaurant derives the corresponding private key offline.
contract StealthAnnouncer {
    /// @param schemeId Stealth scheme identifier (1 = secp256k1 ECDH)
    /// @param stealthAddress The one-time stealth address used in the Order
    /// @param ephemeralPubKey The ephemeral public key (compressed, 33 bytes)
    /// @param viewTag First byte of shared secret — allows fast scanning
    event Announcement(
        uint256 indexed schemeId,
        address indexed stealthAddress,
        bytes ephemeralPubKey,
        uint8 viewTag
    );

    /// @notice Announce a stealth address so the recipient can discover it
    function announce(
        uint256 _schemeId,
        address _stealthAddress,
        bytes calldata _ephemeralPubKey,
        uint8 _viewTag
    ) external {
        emit Announcement(_schemeId, _stealthAddress, _ephemeralPubKey, _viewTag);
    }
}
