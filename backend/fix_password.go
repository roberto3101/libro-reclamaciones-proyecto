package main

import (
	"database/sql"
	"fmt"
	"log"

	_ "github.com/lib/pq"
	"golang.org/x/crypto/bcrypt"
)

func main() {
	db, err := sql.Open("postgres", "postgresql://root@localhost:26257/libroreclamaciones?sslmode=disable")
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	hash, err := bcrypt.GenerateFromPassword([]byte("admin123"), 10)
	if err != nil {
		log.Fatal(err)
	}

	fmt.Println("Generated hash:", string(hash))

	res, err := db.Exec("UPDATE usuarios_admin SET password_hash = $1 WHERE email = $2", string(hash), "admin@demo.com")
	if err != nil {
		log.Fatal(err)
	}

	rows, _ := res.RowsAffected()
	fmt.Printf("Updated %d row(s)\n", rows)

	var stored string
	err = db.QueryRow("SELECT password_hash FROM usuarios_admin WHERE email = $1", "admin@demo.com").Scan(&stored)
	if err != nil {
		log.Fatal(err)
	}

	err = bcrypt.CompareHashAndPassword([]byte(stored), []byte("admin123"))
	if err != nil {
		fmt.Println("VERIFICATION FAILED:", err)
	} else {
		fmt.Println("VERIFICATION OK: password 'admin123' matches stored hash")
	}
}
