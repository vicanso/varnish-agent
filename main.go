// Copyright 2019 tree xie
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package main

import (
	"errors"
	"fmt"
	"os"

	"github.com/vicanso/varnish-agent/agent"
	"github.com/vicanso/varnish-agent/server"
)

func main() {
	config := os.Getenv("CONFIG")
	if config == "" {
		panic(errors.New("config can't be nil"))
	}
	ins, err := agent.NewAgent(config)
	if err != nil {
		panic(err)
	}
	addr := os.Getenv("ADDR")
	if addr == "" {
		addr = ":4000"
	}
	directors, err := ins.GetDirectors()
	if err != nil {
		panic(err)
	}
	// 如果未配置有driector时，只启动agent
	if len(directors) == 0 {
		server.NewServer(ins, addr)
	}
	go server.NewServer(ins, addr)

	go func() {
		ins.Config.Watch(func() {
			e := ins.ReloadVcl()
			if e != nil {
				fmt.Println("reload vcl fail, " + err.Error())
			}
		})
	}()

	err = ins.Exec()
	if err != nil {
		panic(err)
	}
}
