package main

import (
	"time"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

func initLogger() *zap.Logger {
	config := zap.Config{
		Encoding:         "json",
		Level:            zap.NewAtomicLevelAt(zap.InfoLevel),
		OutputPaths:      []string{"/var/log/myapp.log"},
		ErrorOutputPaths: []string{"/var/log/myapp.log"},
		EncoderConfig: zapcore.EncoderConfig{
			MessageKey:   "message",
			LevelKey:     "level",
			TimeKey:      "timestamp",
			EncodeLevel:  zapcore.LowercaseLevelEncoder,
			EncodeTime:   zapcore.ISO8601TimeEncoder,
			EncodeCaller: zapcore.ShortCallerEncoder,
		},
	}

	logger, _ := config.Build()
	return logger
}

func main() {
	logger := initLogger()
	defer logger.Sync()

	counter := 0
	for {
		counter++
		logger.Info("Regular application log",
			zap.Int("count", counter),
			zap.String("app", "logdemo"))

		if counter%3 == 0 {
			logger.Error("Something went wrong",
				zap.Int("count", counter),
				zap.String("app", "logdemo"))
		}

		time.Sleep(2 * time.Second)
	}
}
