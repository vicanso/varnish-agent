import AddUpdateDirector from "./add_update_director";

import { DIRECTORS } from "../urls";
import request from "axios";
import { message } from "antd";

class UpdateDirector extends AddUpdateDirector {
  constructor() {
    super();
    this.state.type = "update";
  }
  submit(data) {
    const { name } = this.props.match.params;
    const url = `${DIRECTORS}/${name}`;
    return request.patch(url, data);
  }
  async componentDidMount() {
    const { name } = this.props.match.params;
    const url = `${DIRECTORS}/${name}`;
    this.setState({
      spinning: true,
      spinTips: "Loading..."
    });
    try {
      const { data } = await request.get(url);
      if (data.backends) {
        data.backends = data.backends.map(item => `${item.ip}:${item.port}`);
      }
      this.setState(
        Object.assign(
          {
            inited: true
          },
          data
        )
      );
    } catch (err) {
      message.error(err.message);
    } finally {
      this.setState({
        spinning: false
      });
    }
  }
}

export default UpdateDirector;
