import {describe, test, expect, beforeEach, afterEach, mock} from "bun:test";
import {logger} from "../../src/utils/logger";

describe("Logger", () => {
    let mockedConsoleLogFunction: any;
    let originalConsoleLogFunction: any;

    beforeEach(() => {
        logger.setLogLevel("info");

        originalConsoleLogFunction = console.log;
        mockedConsoleLogFunction = mock(() => {});
        console.log = mockedConsoleLogFunction;
    });

    afterEach(() => {
        console.log = originalConsoleLogFunction;
    });

    describe("setLogLevel", () => {
        test("should set log level and affect filtering", () => {
            logger.setLogLevel("error");
            logger.info("Should not appear");
            expect(mockedConsoleLogFunction).not.toHaveBeenCalled();

            logger.error("Should appear");
            expect(mockedConsoleLogFunction).toHaveBeenCalled();
        });
    });

    describe("logging methods", () => {
        test("should log debug message", () => {
            logger.setLogLevel("debug");
            logger.debug("Test debug message");

            expect(mockedConsoleLogFunction).toHaveBeenCalledTimes(1);
            const capturedLogMessage = mockedConsoleLogFunction.mock.calls[0][0];
            expect(capturedLogMessage).toContain("[DEBUG]");
            expect(capturedLogMessage).toContain("Test debug message");
        });

        test("should log info message", () => {
            logger.info("Test info message");

            expect(mockedConsoleLogFunction).toHaveBeenCalledTimes(1);
            const capturedLogMessage = mockedConsoleLogFunction.mock.calls[0][0];
            expect(capturedLogMessage).toContain("[INFO]");
            expect(capturedLogMessage).toContain("Test info message");
        });

        test("should log warn message", () => {
            logger.warn("Test warn message");

            expect(mockedConsoleLogFunction).toHaveBeenCalledTimes(1);
            const capturedLogMessage = mockedConsoleLogFunction.mock.calls[0][0];
            expect(capturedLogMessage).toContain("[WARN]");
            expect(capturedLogMessage).toContain("Test warn message");
        });

        test("should log error message", () => {
            logger.error("Test error message");

            expect(mockedConsoleLogFunction).toHaveBeenCalledTimes(1);
            const capturedLogMessage = mockedConsoleLogFunction.mock.calls[0][0];
            expect(capturedLogMessage).toContain("[ERROR]");
            expect(capturedLogMessage).toContain("Test error message");
        });

        test("should accept data object", () => {
            logger.info("Test with data", {symbol: "AAPL", price: 150});

            expect(mockedConsoleLogFunction).toHaveBeenCalledTimes(1);
            const capturedLogArguments = mockedConsoleLogFunction.mock.calls[0];
            expect(capturedLogArguments[0]).toContain("Test with data");
            expect(capturedLogArguments[1]).toEqual({symbol: "AAPL", price: 150});
        });
    });

    describe("specialized logging", () => {
        test("should log trade with formatted message", () => {
            logger.trade("AAPL", "buy", 10, 150.0);

            expect(mockedConsoleLogFunction).toHaveBeenCalledTimes(1);
            const capturedLogArguments = mockedConsoleLogFunction.mock.calls[0];
            expect(capturedLogArguments[0]).toContain("Trade executed");
            expect(capturedLogArguments[0]).toContain("BUY");
            expect(capturedLogArguments[0]).toContain("10");
            expect(capturedLogArguments[0]).toContain("AAPL");
            expect(capturedLogArguments[0]).toContain("$150.00");
            expect(capturedLogArguments[1]).toEqual({
                symbol: "AAPL",
                side: "buy",
                quantity: 10,
                price: 150.0,
                value: 1500.0,
            });
        });

        test("should log signal with formatted message", () => {
            logger.signal("AAPL", "buy", 150.0, "MA crossover");

            expect(mockedConsoleLogFunction).toHaveBeenCalledTimes(1);
            const capturedLogArguments = mockedConsoleLogFunction.mock.calls[0];
            expect(capturedLogArguments[0]).toContain("Signal generated");
            expect(capturedLogArguments[0]).toContain("BUY");
            expect(capturedLogArguments[0]).toContain("AAPL");
            expect(capturedLogArguments[0]).toContain("$150.00");
            expect(capturedLogArguments[1]).toEqual({
                symbol: "AAPL",
                type: "buy",
                price: 150.0,
                reason: "MA crossover",
            });
        });
    });

    describe("log level filtering", () => {
        test("should filter debug when level is info", () => {
            logger.setLogLevel("info");
            logger.debug("Debug message");

            expect(mockedConsoleLogFunction).not.toHaveBeenCalled();
        });

        test("should filter debug and info when level is warn", () => {
            logger.setLogLevel("warn");
            logger.debug("Debug message");
            logger.info("Info message");

            expect(mockedConsoleLogFunction).not.toHaveBeenCalled();

            logger.warn("Warn message");
            expect(mockedConsoleLogFunction).toHaveBeenCalledTimes(1);
        });

        test("should only show errors when level is error", () => {
            logger.setLogLevel("error");

            logger.debug("Debug message");
            logger.info("Info message");
            logger.warn("Warn message");

            expect(mockedConsoleLogFunction).not.toHaveBeenCalled();

            logger.error("Error message");
            expect(mockedConsoleLogFunction).toHaveBeenCalledTimes(1);
        });

        test("should show all logs at debug level", () => {
            logger.setLogLevel("debug");

            logger.debug("Debug message");
            logger.info("Info message");
            logger.warn("Warn message");
            logger.error("Error message");

            expect(mockedConsoleLogFunction).toHaveBeenCalledTimes(4);
        });
    });
});