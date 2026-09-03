package main

import (
	"fmt"
	"os"
	"golang.org/x/crypto/bcrypt"
)

func main() {
	if len(os.Args) < 3 {
		fmt.Println("uso: go run ./cmd/test_pwd/ <password> <hash>")
		return
	}
	err := bcrypt.CompareHashAndPassword([]byte(os.Args[2]), []byte(os.Args[1]))
	fmt.Printf("Password '%s' match: %v\n", os.Args[1], err == nil)
}
