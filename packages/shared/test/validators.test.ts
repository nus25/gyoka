import { describe, it, expect } from 'vitest';

import { feedUri, postUri, repostUri, did } from '../src/validators';

describe('validator', () => {
    describe('feedUri', () => {
        it('should validate a correct feed AT Protocol URI', () => {
            const validCharUri = 'at://did:plc:1234abcd/app.bsky.feed.generator/A-Za-z0-9._~:-';
            expect(() => feedUri.parse(validCharUri)).not.toThrow();
            const validMaxLengthUri = 'at://did:plc:1234abcd/app.bsky.feed.generator/' + '12345678'.repeat(64);
            expect(() => feedUri.parse(validMaxLengthUri)).not.toThrow();

        });

        it('should throw an error for an invalid feed AT Protocol URI', () => {
            const invalidUri = 'at://did:plc:1234abcd/app.bsky.feed.generator/';
            const result = feedUri.safeParse(invalidUri);
            expect(result.success).toBe(false);
            expect(result.error.errors[0].message).toBe(`Invalid AT Protocol URI format. Expected format: at://{DID}/app.bsky.feed.generator/{record-key}`);
        });

        it('should throw an error for a feed AT Protocol URI with an invalid collection', () => {
            const invalidUri = 'at://did:plc:1234abcd/app.bsky.feed.invalid/feedrkey';
            const result = feedUri.safeParse(invalidUri);
            expect(result.success).toBe(false);
            expect(result.error.errors[0].message).toBe(`Invalid AT Protocol URI format. Expected format: at://{DID}/app.bsky.feed.generator/{record-key}`);
        });

        it('should throw an error for a feed AT Protocol URI with an invalid rkey', () => {
            const invalidUri1 = 'at://did:plc:1234abcd/app.bsky.feed.generator/..';
            const result1 = feedUri.safeParse(invalidUri1);
            const invalidUri2 = 'at://did:plc:1234abcd/app.bsky.feed.generator/./';
            const result2 = feedUri.safeParse(invalidUri2);
            const invalidUri3 = 'at://did:plc:1234abcd/app.bsky.feed.generator/too_long-' + '12345678'.repeat(63);
            const result3 = feedUri.safeParse(invalidUri3);

            const resuslst = [result1, result2, result3];
            resuslst.forEach((result) => {
                console.log(result);
                expect(result.success).toBe(false);
                expect(result.error.errors[0].message).toBe(`Invalid AT Protocol URI format. Expected format: at://{DID}/app.bsky.feed.generator/{record-key}`);
            });
        });
    });

    describe('postUri', () => {
        it('should validate a correct post AT Protocol URI', () => {
            const validUri = 'at://did:plc:1234abcd/app.bsky.feed.post/xyz123';
            expect(() => postUri.parse(validUri)).not.toThrow();
        });

        it('should throw an error for an invalid post AT Protocol URI', () => {
            const invalidUri = 'at://did:plc:1234abcd/app.bsky.feed.post/';
            const result = postUri.safeParse(invalidUri);
            expect(result.success).toBe(false);
            expect(result.error.errors[0].message).toBe('Invalid AT Protocol URI format. Expected format: at://{DID}/app.bsky.feed.post/{record-key}');
        });

        it('should throw an error for a post AT Protocol URI with an invalid collection', () => {
            const invalidUri = 'at://did:plc:1234abcd/app.bsky.feed.invalid/xyz123';
            const result = postUri.safeParse(invalidUri);
            expect(result.success).toBe(false);
            expect(result.error.errors[0].message).toBe('Invalid AT Protocol URI format. Expected format: at://{DID}/app.bsky.feed.post/{record-key}');
        });
    });
    describe('repostUri', () => {
        it('should validate a correct repost AT Protocol URI', () => {
            const validUri = 'at://did:plc:1234abcd/app.bsky.feed.repost/repost123';
            console.log(repostUri.parse(validUri));
            expect(() => repostUri.parse(validUri)).not.toThrow();
        });

        it('should throw an error for an invalid repost AT Protocol URI', () => {
            const invalidUri = 'at://did:plc:1234abcd/app.bsky.feed.repost/';
            expect(() => repostUri.parse(invalidUri)).toThrow('Invalid AT Protocol URI format. Expected format: at://{DID}/app.bsky.feed.repost/{record-key}');
        });

        it('should throw an error for a repost AT Protocol URI with an invalid collection', () => {
            const invalidUri = 'at://did:plc:1234abcd/app.bsky.feed.invalid/repost123';
            expect(() => repostUri.parse(invalidUri)).toThrow('Invalid AT Protocol URI format. Expected format: at://{DID}/app.bsky.feed.repost/{record-key}');
        });
    });

    describe('did', () => {
        it('should validate a correct DID', () => {
            const validDid = 'did:plc:user.example.com';
            expect(() => did.parse(validDid)).not.toThrow();
        });

        it('should throw an error for an invalid DID', () => {
            const invalidDid = 'invalid:plc:user.example.com';
            expect(() => did.parse(invalidDid)).toThrow('Invalid DID format. Expected format: did:{method}:{identifier}');
        });

        it('should throw an error for a DID without a method', () => {
            const invalidDid = 'did::user.example.com';
            expect(() => did.parse(invalidDid)).toThrow('Invalid DID format. Expected format: did:{method}:{identifier}');
        });
    });
});