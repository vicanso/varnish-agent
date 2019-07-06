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

package config

import (
	"context"
	"net/url"
	"path/filepath"
	"strings"
	"time"

	"go.etcd.io/etcd/clientv3"
)

type (
	// EtcdConfig etcd config
	EtcdConfig struct {
		path   string
		client *clientv3.Client
		Name   string
	}
)

var (
	defaultEtcdTimeout = 5 * time.Second
)

func parseEtcdConfig(uri string) (conf clientv3.Config, path string, err error) {
	u, err := url.Parse(uri)
	if err != nil {
		return
	}
	conf = clientv3.Config{
		Endpoints: strings.Split(u.Host, ","),
	}
	if u.User != nil {
		conf.Username = u.User.Username()
		conf.Password, _ = u.User.Password()
	}
	path = u.Path
	return
}

// NewEtcdConfig new etcd config
func NewEtcdConfig(uri string) (etcdConfig *EtcdConfig, err error) {
	conf, path, err := parseEtcdConfig(uri)
	if err != nil {
		return
	}

	cli, err := clientv3.New(conf)
	if err != nil {
		return
	}
	etcdConfig = &EtcdConfig{
		client: cli,
		path:   path,
	}
	return
}

func (ec *EtcdConfig) getKey() string {
	return filepath.Join(ec.path, ec.Name)
}

// ReadConfig read config
func (ec *EtcdConfig) ReadConfig() (data []byte, err error) {
	ctx, cancel := context.WithTimeout(context.Background(), defaultEtcdTimeout)

	resp, err := ec.client.Get(ctx, ec.getKey())
	cancel()
	if err != nil {
		return
	}
	kvs := resp.Kvs
	if len(kvs) == 0 {
		return
	}
	data = kvs[0].Value
	return
}

// WriteConfig write config
func (ec *EtcdConfig) WriteConfig(data []byte) (err error) {
	ctx, cancel := context.WithTimeout(context.Background(), defaultEtcdTimeout)
	_, err = ec.client.Put(ctx, ec.getKey(), string(data))
	cancel()
	if err != nil {
		return
	}
	return
}

// Watch watch the config change
func (ec *EtcdConfig) Watch(fn func()) {
	rch := ec.client.Watch(context.Background(), ec.getKey())
	// 只监听有变化则可
	for range rch {
		fn()
	}
}

// Close close the client
func (ec *EtcdConfig) Close() error {
	return ec.client.Close()
}
