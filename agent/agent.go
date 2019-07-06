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

package agent

import (
	"crypto/sha1"
	"encoding/hex"
	"errors"
	"fmt"
	"io/ioutil"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/go-yaml/yaml"
	"github.com/vicanso/varnish-agent/config"
	"github.com/vicanso/varnish-agent/director"
)

type (
	// VarnishConfig vcl config
	VarnishConfig struct {
		Pid     int      `json:"pid,omitempty"`
		Args    []string `json:"args,omitempty"`
		Version string   `json:"version,omitempty"`
		File    string   `json:"file,omitempty"`
		Hash    string   `json:"hash,omitempty"`
	}
	// Agent varnish agent
	Agent struct {
		Config        config.ReadWriter
		VarnishConfig *VarnishConfig
	}
)

func indexOf(arr []string, key string) int {
	index := -1
	for i, v := range arr {
		if key == v {
			index = i
		}
	}
	return index
}

// NewAgent create an agent
func NewAgent(uri string) (*Agent, error) {
	if !strings.HasPrefix(uri, "etcd://") {
		return nil, errors.New("Only support etcd")
	}
	// TODO 以后可以支持再多的配置存储
	rw, err := config.NewEtcdConfig(uri)
	if err != nil {
		return nil, err
	}
	return &Agent{
		Config: rw,
		VarnishConfig: &VarnishConfig{
			Version: os.Getenv("VERSION"),
		},
	}, nil
}

// GetDirectors get directors
func (ins *Agent) GetDirectors() (s director.Directors, err error) {
	buf, err := ins.Config.ReadConfig()
	if err != nil {
		return
	}
	m := make(map[string]*director.Director)
	err = yaml.Unmarshal(buf, &m)
	if err != nil {
		return
	}
	s = make(director.Directors, 0)
	for name, d := range m {
		d.Name = name
		s = append(s, d)
	}
	return
}

// GetVcl get vcl
func (ins *Agent) GetVcl() (vcl string, err error) {
	s, err := ins.GetDirectors()
	if err != nil {
		return
	}
	vcl, err = s.GetVcl()
	if err != nil {
		return
	}

	return
}

// Save save directors to vcl
func (ins *Agent) Save(s director.Directors) (err error) {
	m := make(map[string]*director.Director)
	for _, d := range s {
		if m[d.Name] != nil {
			err = errors.New(d.Name + " is duplicated")
			return
		}
		m[d.Name] = d
	}
	buf, err := yaml.Marshal(m)
	if err != nil {
		return
	}
	err = ins.Config.WriteConfig(buf)
	if err != nil {
		return
	}
	return
}

func (ins *Agent) generateVcl() (file string, hash string, err error) {
	dir, _ := os.UserHomeDir()
	if dir == "" {
		dir = os.TempDir()
	}
	file = dir + time.Now().Format("20060102T150405")
	vcl, err := ins.GetVcl()
	if err != nil {
		return
	}
	err = ioutil.WriteFile(file, []byte(vcl), 0600)
	if err != nil {
		return
	}
	sha1 := sha1.New()
	sha1.Write([]byte(vcl))
	hash = hex.EncodeToString(sha1.Sum(nil))

	return
}

// ReloadVcl reload vcl
func (ins *Agent) ReloadVcl() (err error) {
	file, hash, err := ins.generateVcl()
	if err != nil {
		return
	}
	// 如果没有变化，则无需重新加载
	if ins.VarnishConfig.Hash == hash {
		return
	}
	configname := "C-" + filepath.Base(file)
	// 加载 vcl 配置
	cmd := exec.Command("varnishadm", "vcl.load", configname, file, "auto")
	fmt.Println(strings.Join(cmd.Args, " "))
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	err = cmd.Run()
	if err != nil {
		return
	}
	// 使用当前加载配置
	cmd = exec.Command("varnishadm", "vcl.use", configname)
	fmt.Println(strings.Join(cmd.Args, " "))
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	err = cmd.Run()
	if err != nil {
		return
	}
	ins.VarnishConfig.File = file
	ins.VarnishConfig.Hash = hash
	return
}

func (ins *Agent) getArgs() []string {
	// 启动varnish
	args := []string{
		"-F",
		"-p",
		"default_ttl=0",
	}
	isExists := func(key string) bool {
		return indexOf(args, key) != -1
	}
	params := os.Getenv("PARAMS")
	if params != "" {
		arr := strings.Split(params, " ")
		args = append(args, arr...)
	}
	// 如果未指定端口
	if !isExists("-a") {
		args = append(args, []string{
			"-a",
			":8080",
		}...)
	}
	// 如果未指定存储方式
	if !isExists("-s") {
		args = append(args, []string{
			"-s",
			"malloc,1G",
		}...)
	}
	return args
}

// Exec execute varnish
func (ins *Agent) Exec() (err error) {
	file, hash, err := ins.generateVcl()
	if err != nil {
		return
	}
	// 启动varnish
	args := ins.getArgs()
	ins.VarnishConfig.Args = args[:]
	args = append([]string{
		"-f",
		file,
	}, args...)

	cmd := exec.Command("varnishd", args...)
	fmt.Println(strings.Join(cmd.Args, " "))
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	ins.VarnishConfig.File = file
	ins.VarnishConfig.Hash = hash
	go func() {
		time.Sleep(5 * time.Second)
		ins.VarnishConfig.Pid = cmd.Process.Pid
	}()
	err = cmd.Run()
	if err != nil {
		return
	}
	return
}
